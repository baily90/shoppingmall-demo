// 评估器（evaluator）：复用生产用的 chatModel 当裁判。
// 签名统一为 ({ input, output, expectedOutput }) => 分数，供 Dataset + Experiment 和在线打分共用。
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { chatModel } from '../llm/llm.service.js';

// ① LLM 裁判分：准确性（1-5 分）
// 注意：这里裁判和 agent 用同一个模型（deepseek-chat），存在"自我偏见"风险。
// 生产环境建议用更强的模型当裁判，或先人工校准。
export async function correctnessEvaluator(params: {
  input: unknown;
  output: unknown;
  expectedOutput?: unknown;
}) {
  const { input, output, expectedOutput } = params;

  const result = await generateText({
    model: chatModel,
    temperature: 0, // 裁判要确定性
    prompt: `你是电商客服质检员。评估下面客服回答的准确性（1-5 分）。
1=严重错误/答非所问 2=部分错误 3=基本正确有小瑕疵 4=正确 5=完全正确且完整。

用户问题：${input}
客服回答：${output}
${expectedOutput ? `参考答案要点：${expectedOutput}` : ''}

只返回 JSON：{"score": 数字, "reason": "一句话理由"}`,
    output: Output.object({
      schema: z.object({
        score: z.number().min(1).max(5),
        reason: z.string(),
      }),
    }),
  });

  return {
    name: 'correctness',
    value: result.output.score,
    dataType: 'NUMERIC' as const,
    comment: result.output.reason,
  };
}

// ② 规则分：回答长度是否在合理区间（零成本，确定性）
export async function lengthEvaluator(params: { output: unknown }) {
  const len = String(params.output).trim().length;
  const ok = len >= 5 && len <= 2000;
  return {
    name: 'length_ok',
    value: ok ? 1 : 0,
    dataType: 'BOOLEAN' as const,
    comment: `回答长度 ${len} 字`,
  };
}

// ③ LLM 裁判分：忠实度（faithfulness，1-5 分）
// 判断回答是否"编造了知识库上下文里没有的事实"（幻觉）。这是生成环节的核心指标，
// 也是 correctness 测不出来的——答案可能"对"，但来源是编的。
//
// 拆两层，各管一个场景：
//   - judgeFaithfulness：核心裁判，直接吃 (answer, context)。给 generation-eval 用——
//     那边上下文是 golden set 里"钉死"的，不经过检索，所以不需要 retrieve。
//   - faithfulnessEvaluator：端到端评测的适配层。runExperiment 的 task 只回传纯文本
//     （回答），拿不到 agent 内部召回了哪些 FAQ，所以这里让裁判自己 retrieve 召回一遍
//     （与 agent 的 getFaq 同源）当判据，再交给 judgeFaithfulness。
export async function judgeFaithfulness(params: { answer: string; context: string }) {
  const { answer, context } = params;

  const result = await generateText({
    model: chatModel,
    temperature: 0,
    prompt: `你是电商客服质检员。评估下面客服回答的"忠实度"——回答是否只基于给定的知识库上下文，有没有编造上下文里没有的事实信息（幻觉）。

1=大量编造 2=明显编造 3=有少量编造或夸大 4=基本忠实、偶有轻微引申 5=完全忠实、无编造

知识库上下文：
${context}

客服回答：
${answer}

只返回 JSON：{"score": 数字, "reason": "一句话理由"}`,
    output: Output.object({
      schema: z.object({
        score: z.number().min(1).max(5),
        reason: z.string(),
      }),
    }),
  });

  return {
    name: 'faithfulness',
    value: result.output.score,
    dataType: 'NUMERIC' as const,
    comment: result.output.reason,
  };
}

export function faithfulnessEvaluator(
  retrieve: (query: string) => Promise<Array<{ question: string; answer: string }>>,
) {
  return async (params: { input: unknown; output: unknown }) => {
    const question = String(params.input);
    const answer = String(params.output);

    const hits = await retrieve(question);
    const context =
      hits.map((h) => `【${h.question}】${h.answer}`).join('\n') || '（未召回任何上下文）';

    return judgeFaithfulness({ answer, context });
  };
}
