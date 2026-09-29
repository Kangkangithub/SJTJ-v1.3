/**
 * Agent 工具集（Tool Calling）
 *
 * @description 把神农AI 的多个 AI 能力封装为 Agent 可调用的「工具」，
 *   供 agentService 的 ReAct 循环调度。每个工具有 name/description/run 三要素。
 */

const hybridSearchService = require("./hybridSearchService");
const path = require("path");
const fs = require("fs");

// =============================================
// 加载配伍规则（十八反十九畏）
// =============================================
const rulesPath = path.join(__dirname, "../../data/compatibility_rules.json");
let compatRules = [];
let compatAliases = {};
try {
  const data = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
  compatRules = data.rules || [];
  compatAliases = data.aliases || {};
} catch (e) {
  console.warn("[AgentTools] 配伍规则加载失败:", e.message);
}

// 解析别名（可能是字符串/数组）
function splitAliases(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value).split(/[,，、\s]+/).filter(Boolean);
}

// =============================================
// 工具1：search_herbs —— 三路混合检索
// =============================================
const searchHerbsTool = {
  name: "search_herbs",
  description: "检索与问题相关的药材，使用三路混合检索（BM25全文 + 向量语义 + 知识图谱）+ RRF 融合，返回排序后的药材名列表",
  parameters: { question: "检索问题或关键词，如“补气药材有哪些”" },
  async run(args) {
    const q = args.question || args.q || "";
    if (!q) return { text: "缺少检索问题", herbs: [] };
    const hybrid = await hybridSearchService.hybridSearch(q, []);
    const herbs = hybrid.ranked.slice(0, 10).map(r => r.name);
    if (herbs.length === 0) return { text: "未检索到相关药材", herbs: [] };
    return { text: "检索到药材：" + herbs.join("、"), herbs: herbs };
  }
};

// =============================================
// 工具2：check_compatibility —— 配伍冲突检测
// =============================================
const checkCompatibilityTool = {
  name: "check_compatibility",
  description: "检测多味药材之间是否存在配伍禁忌（十八反、十九畏），返回冲突列表",
  parameters: { herbs: "药材名数组，如 [\"人参\", \"藜芦\"]" },
  async run(args) {
    let herbs = args.herbs;
    if (typeof herbs === "string") herbs = herbs.split(/[,，、\s]+/).filter(Boolean);
    if (!Array.isArray(herbs) || herbs.length < 2) return "请提供至少 2 味药材";

    const conflicts = [];
    for (let i = 0; i < herbs.length; i++) {
      for (let j = i + 1; j < herbs.length; j++) {
        const a = String(herbs[i]).trim();
        const b = String(herbs[j]).trim();
        for (const rule of compatRules) {
          const aAliases = [rule.herb_a, ...splitAliases(compatAliases[rule.herb_a])];
          const bAliases = [rule.herb_b, ...splitAliases(compatAliases[rule.herb_b])];
          const aMatchA = aAliases.includes(a);
          const bMatchB = bAliases.includes(b);
          const aMatchB = bAliases.includes(a);
          const bMatchA = aAliases.includes(b);
          if ((aMatchA && bMatchB) || (aMatchB && bMatchA)) {
            conflicts.push({
              herb_a: a, herb_b: b,
              relation: rule.relation || "",
              category: rule.category || "",
              source: rule.source || ""
            });
            break;
          }
        }
      }
    }
    if (conflicts.length === 0) return "未发现配伍冲突";
    return "发现配伍冲突：" + conflicts.map(c =>
      `${c.herb_a} 与 ${c.herb_b} ${c.relation}（${c.category}${c.source ? "，" + c.source : ""}）`
    ).join("；");
  }
};

// =============================================
// 工具注册表
// =============================================
const agentTools = [searchHerbsTool, checkCompatibilityTool];

function getTool(name) {
  return agentTools.find(t => t.name === name);
}

function getToolDescriptions() {
  return agentTools.map(t =>
    `- ${t.name}: ${t.description}（参数：${JSON.stringify(t.parameters)}）`
  ).join("\n");
}

module.exports = { agentTools, getTool, getToolDescriptions };
