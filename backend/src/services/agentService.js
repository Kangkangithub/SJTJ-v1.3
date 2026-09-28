/**
 * Agent 服务（多 Agent 编排 + Tool Calling 核心）
 *
 * @description 用 ReAct 模式实现 Agent 循环：
 *   LLM 自主分解问题 → 调用工具 → 观察结果 → 多步迭代 → 生成答案，
 *   并完整记录思维链（思考 / 工具调用 / 工具结果 / 最终答案）。
 */

const { ChatOpenAI } = require("@langchain/openai");
const { agentTools, getTool, getToolDescriptions } = require("./agentTools");

const MAX_ITERATIONS = 8; // 最大工具调用轮数，防止无限循环

let llm = null;

// =============================================
// 初始化 LLM（DeepSeek，惰性）
// =============================================
function initializeLLM() {
  if (llm) return llm;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "YOUR_DEEPSEEK_API_KEY_HERE") {
    console.warn("[Agent] DeepSeek API Key 未配置");
    return null;
  }
  llm = new ChatOpenAI({
    modelName: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    apiKey,
    temperature: 0.2,
    configuration: { baseURL: "https://api.deepseek.com" }
  });
  return llm;
}

// =============================================
// 构建系统提示词（含工具描述 + ReAct 格式）
// =============================================
function buildSystemPrompt() {
  return `你是神农AI，一个专业的中医药知识问答助手。你可以使用以下工具来回答问题：

${getToolDescriptions()}

请严格按以下 ReAct 格式输出（每次只输出一步）：

Thought: 你的思考过程
Action: 工具名
Action Input: 工具参数（JSON 格式，如 {"question":"补气药材"}）

当工具返回结果后，你会收到 Observation，然后继续思考并决定是否再调用工具。

当你已经有足够信息回答时，输出：

Final Answer: 最终答案（完整、专业、面向用户）

规则（非常重要，必须遵守）：
1. 每次只输出「Thought + Action + Action Input」三步，然后立即停止，等待系统返回 Observation
2. 绝对不要自己编造 Observation，Observation 只能由系统提供
3. 绝对不要在一次输出里完成整个循环，不要提前输出 Final Answer
4. 只有收到足够的 Observation 后，才在下一步单独输出 Final Answer`;
}

// =============================================
// 解析 ReAct 输出
// =============================================
function parseReAct(text) {
  if (!text) return { thought: "", action: null, actionInput: null, finalAnswer: null };

  // 先解析 Thought
  const thought = (text.match(/Thought\s*[:：]\s*([\s\S]*?)(?=\nAction\s*[:：]|\nFinal Answer\s*[:：]|$)/) || [])[1]?.trim() || "";

  // 优先解析 Action（工具调用）：即使 LLM 同时预演了 Final Answer，也先执行工具
  const actionMatch = text.match(/Action\s*[:：]\s*([^\n]+)/);
  const action = actionMatch ? actionMatch[1].trim() : null;

  if (action) {
    // 解析 Action Input（到下一个 Thought/Action/Observation/Final Answer 或结尾为止）
    const inputMatch = text.match(/Action Input\s*[:：]\s*([\s\S]*?)(?=\n(?:Thought|Action|Observation|Final Answer)\s*[:：]|$)/);
    let actionInput = inputMatch ? inputMatch[1].trim() : null;
    if (actionInput) {
      try { actionInput = JSON.parse(actionInput); }
      catch (e) { actionInput = { value: actionInput }; }
    } else {
      actionInput = {};
    }
    return { thought, action, actionInput, finalAnswer: null };
  }

  // 没有 Action，才检查 Final Answer
  const finalMatch = text.match(/Final Answer\s*[:：]\s*([\s\S]*)/);
  if (finalMatch) {
    return { thought, action: null, actionInput: null, finalAnswer: finalMatch[1].trim() };
  }

  return { thought, action: null, actionInput: null, finalAnswer: null };
}

// =============================================
// 调用 LLM
// =============================================
async function callLLM(messages) {
  const model = initializeLLM();
  if (!model) return null;
  const response = await model.invoke(messages);
  return typeof response.content === "string" ? response.content : "";
}

// =============================================
// Agent 主循环
// =============================================
async function runAgent(question) {
  const model = initializeLLM();
  if (!model) {
    return { answer: "", steps: [], error: "LLM 未初始化" };
  }

  const steps = []; // 思维链
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: question }
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response;
    try {
      response = await callLLM(messages);
    } catch (e) {
      steps.push({ type: "error", content: "LLM 调用失败：" + e.message });
      break;
    }
    if (!response) break;

    const parsed = parseReAct(response);

    // 有最终答案 → 结束
    if (parsed.finalAnswer) {
      steps.push({ type: "answer", content: parsed.finalAnswer });
      return { answer: parsed.finalAnswer, steps, error: null };
    }

    // 有工具调用 → 执行工具
    if (parsed.action) {
      const tool = getTool(parsed.action);
      if (!tool) {
        // 工具不存在，提示 LLM 重新选择
        messages.push({ role: "assistant", content: response });
        messages.push({ role: "user", content: `Observation: 工具 "${parsed.action}" 不存在，可用工具：${agentTools.map(t => t.name).join("、")}` });
        steps.push({ type: "thought", content: parsed.thought || "尝试调用不存在的工具" });
        continue;
      }

      steps.push({ type: "thought", content: parsed.thought || "" });
      steps.push({ type: "tool_call", tool: parsed.action, args: parsed.actionInput || {} });

      let result;
      try {
        result = await tool.run(parsed.actionInput || {});
      } catch (e) {
        result = "工具调用失败：" + e.message;
      }
      steps.push({ type: "tool_result", content: result });

      messages.push({ role: "assistant", content: response });
      messages.push({ role: "user", content: "Observation: " + result });
    } else {
      // 既无 Final Answer 也无 Action，结束循环
      steps.push({ type: "error", content: "Agent 输出格式异常，无法继续" });
      break;
    }
  }

  return { answer: "", steps, error: "达到最大迭代次数仍未得到答案" };
}

// =============================================
// 对外主入口：Agent 问答（含兜底）
// =============================================
async function answerWithAgent(question) {
  try {
    const result = await runAgent(question);
    if (result.answer) {
      return { answer: result.answer, steps: result.steps, mode: "agent" };
    }
    // Agent 未得到答案，返回空（由调用方兜底）
    return { answer: "", steps: result.steps, mode: "agent-failed", error: result.error };
  } catch (e) {
    console.error("[Agent] Agent 执行失败:", e.message);
    return { answer: "", steps: [], mode: "agent-error", error: e.message };
  }
}

module.exports = { answerWithAgent, runAgent, getToolDescriptions };
