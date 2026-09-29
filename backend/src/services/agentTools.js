/**
 * Agent 工具集（Tool Calling）
 *
 * @description 把神农AI 的多个 AI 能力封装为 Agent 可调用的「工具」，
 *   供 agentService 的 ReAct 循环调度。每个工具有 name/description/run 三要素。
 *
 * 工具返回约定：
 *   - 可返回纯字符串（供 LLM 阅读的 Observation）
 *   - 也可返回对象 { text, herbs?, formulas?, media? }，
 *     text 给 LLM，结构化字段给前端渲染（参考药材 / 方剂 / 多媒体）。
 */

const hybridSearchService = require("./hybridSearchService");
const ragServiceV2 = require("./ragServiceV2");
const path = require("path");
const fs = require("fs");

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

// 多媒体目录
const HERB_IMAGE_DIR = path.join(__dirname, "../../uploads/herbs");
const HERB_VIDEO_DIR = path.join(__dirname, "../../uploads/videos");
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];

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

// 调用 DeepSeek（非流式，用于工具内的知识增强）
async function callDeepSeek(messages, temperature = 0.3, maxTokens = 800) {
  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "YOUR_DEEPSEEK_API_KEY_HERE") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + DEEPSEEK_API_KEY
      },
      body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, temperature, max_tokens: maxTokens, stream: false }),
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn("[AgentTools] DeepSeek 调用失败:", e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
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
// 工具2：search_formulas —— 方剂检索（Neo4j 图检索）
// =============================================
const searchFormulasTool = {
  name: "search_formulas",
  description: "检索与问题相关的方剂（如四君子汤、补中益气汤），返回方剂名称与功效/组成描述",
  parameters: { question: "检索问题或方剂关键词，如“补气方剂有哪些”或“四君子汤”" },
  async run(args) {
    const q = args.question || args.q || "";
    if (!q) return { text: "缺少检索问题", formulas: [] };
    const formulas = await ragServiceV2.searchFormulas(q, []);
    if (!formulas || formulas.length === 0) return { text: "未检索到相关方剂", formulas: [] };
    const names = formulas.map(f => f.name);
    const desc = formulas
      .map(f => f.name + (f.description ? "（" + f.description.slice(0, 60) + "）" : ""))
      .join("；");
    return { text: "检索到方剂：" + desc, formulas: names };
  }
};

// =============================================
// 工具3：enrich_herb —— LLM 知识增强
// =============================================
const enrichHerbTool = {
  name: "enrich_herb",
  description: "对某一味具体药材做 LLM 知识增强，补充主治、用法用量、注意事项、现代药理、临床应用等深度知识",
  parameters: { herb: "单一药材名，如“人参”" },
  async run(args) {
    const name = String(args.herb || args.name || "").trim();
    if (!name) return { text: "缺少药材名", herbs: [] };
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "YOUR_DEEPSEEK_API_KEY_HERE") {
      return { text: "知识增强服务未配置（缺少模型 Key）", herbs: [name] };
    }
    const prompt = "你是资深中医药专家。请为药材【" + name + "】撰写详细信息，" +
      "以严格 JSON 格式直接返回（不要任何解释、不要 Markdown）：" +
      '{"indications":"主治病症（50-150字）","usage_dosage":"用法用量（20-80字）",' +
      '"caution":"使用注意与禁忌（20-80字）","pharmacology":"现代药理研究摘要（50-150字）",' +
      '"clinical_application":"临床应用要点（30-100字）"}';
    const content = await callDeepSeek([
      { role: "system", content: "你是中医药专家。只返回 JSON，不要任何解释或 Markdown。" },
      { role: "user", content: prompt }
    ]);
    if (!content) return { text: "药材【" + name + "】知识增强失败", herbs: [name] };

    let parsed = null;
    try {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (e) {
      parsed = null;
    }

    const text = parsed
      ? [
          "主治：" + (parsed.indications || ""),
          "用法用量：" + (parsed.usage_dosage || ""),
          "注意事项：" + (parsed.caution || ""),
          "现代药理：" + (parsed.pharmacology || ""),
          "临床应用：" + (parsed.clinical_application || "")
        ].join("；")
      : content;

    return { text: "药材【" + name + "】知识增强：" + text, herbs: [name] };
  }
};

// =============================================
// 工具4：herb_media —— 单一药材多媒体（图片/视频）
// =============================================
const herbMediaTool = {
  name: "herb_media",
  description: "当用户询问某一味具体药材的信息、图片、视频、长相或外观时使用，返回该药材的图片和视频链接。宽泛问题（如推荐多味药材）不要调用",
  parameters: { herb: "单一药材名，如“人参”" },
  async run(args) {
    const name = String(args.herb || args.name || "").trim();
    if (!name) return { text: "缺少药材名", media: [] };

    const media = [];
    for (const ext of IMAGE_EXTENSIONS) {
      if (fs.existsSync(path.join(HERB_IMAGE_DIR, name + ext))) {
        media.push({ type: "image", url: "/uploads/herbs/" + name + ext, name });
        break;
      }
    }
    for (const ext of VIDEO_EXTENSIONS) {
      if (fs.existsSync(path.join(HERB_VIDEO_DIR, name + ext))) {
        media.push({ type: "video", url: "/uploads/videos/" + name + ext, name });
        break;
      }
    }

    if (media.length === 0) return { text: "药材【" + name + "】暂无图片或视频", media: [] };
    const imgCount = media.filter(m => m.type === "image").length;
    const vidCount = media.filter(m => m.type === "video").length;
    return {
      text: "药材【" + name + "】找到 " + imgCount + " 张图片、 " + vidCount + " 个视频",
      media
    };
  }
};

// =============================================
// 工具5：check_compatibility —— 配伍冲突检测
// =============================================
const checkCompatibilityTool = {
  name: "check_compatibility",
  description: "检测多味药材之间是否存在配伍禁忌（十八反、十九畏），返回冲突列表",
  parameters: { herbs: "药材名数组，如 [人参, 藜芦]" },
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
      c.herb_a + " 与 " + c.herb_b + " " + c.relation + "（" + c.category + (c.source ? "，" + c.source : "") + "）"
    ).join("；");
  }
};

// =============================================
// 工具注册表
// =============================================
const agentTools = [searchHerbsTool, searchFormulasTool, enrichHerbTool, herbMediaTool, checkCompatibilityTool];

function getTool(name) {
  return agentTools.find(t => t.name === name);
}

function getToolDescriptions() {
  return agentTools.map(t =>
    "- " + t.name + ": " + t.description + "（参数：" + JSON.stringify(t.parameters) + "）"
  ).join("\n");
}

module.exports = { agentTools, getTool, getToolDescriptions };
