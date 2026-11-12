// 离线生成评测：固定上下文 → 生成回答 → 判忠实度（faithfulness）
// 跑法：pnpm --filter customer-service generation-eval
//
// 与 rag-eval 的分工：
//   - rag-eval 测「检索」这一段（召回得对不对）
//   - 这里测「生成」这一段（给定上下文，模型写出的回答有没有编造）
// 上下文在 golden set 里钉死（不走 embedding/rerank），所以检索质量不会污染生成质量的测量，
// 只换 prompt / 模型就能单独对比生成层。不 import ../llm/langfuse.js，纯离线打印。
import 'dotenv/config';
import { generateText } from 'ai';
import { chatModel } from '../llm/llm.service.js';
import { judgeFaithfulness } from './evaluators.js';
import { FAQ_SEED } from '../rag/faq.seed.js';

// 生成层的系统提示词（隔离版）。生产里真实的是 chat.service.ts 的 SYSTEM_PROMPT + getFaq 工具；
// 这里是"检索已完成、上下文直接给模型"的生成环节，抽这句出来方便单独改 prompt 对比。
const GENERATION_SYSTEM = `你是电商客服助手。
规则：
1. 严格基于下面给出的「知识库检索结果」回答，不要编造检索结果里没有的信息。
2. 检索结果里没有答案时，诚实说不知道，并引导用户转人工客服。`;

// 生成 golden set：question → 应作为上下文的 FAQ 问题文本（钉死，不走检索）。
// contextQuestions 为空 = 模拟"检索不到"：上下文为空，理想是模型诚实说不知道、而不是编。
const genGoldenSet: Array<{ question: string; contextQuestions: string[] }> = [
  { question: '怎么申请退款？', contextQuestions: ['怎么申请退款？'] },
  { question: '退款多久到账？', contextQuestions: ['退款多久到账？'] },
  { question: '优惠券过期了还能用吗？', contextQuestions: ['优惠券过期了还能用吗？'] },
  { question: '7 天无理由退货的条件？', contextQuestions: ['7 天无理由退货的条件？'] },
  { question: '退货的运费谁承担？', contextQuestions: ['退货的运费谁承担？'] },
  // 易混：上下文只有"质量问题怎么办"（内含"质量问题运费商家承担"），
  // 考模型会不会把它扩展成"所有退货运费都商家承担"（编造）
  { question: '商品有质量问题怎么办？', contextQuestions: ['商品有质量问题怎么办？'] },
  // 无上下文：理想是诚实说不知道、不编造
  { question: '运费险怎么用', contextQuestions: [] },
];

async function main() {
  const answerByQuestion = new Map(FAQ_SEED.map((f) => [f.question, f.answer]));
  const missing = genGoldenSet
    .flatMap((g) => g.contextQuestions)
    .filter((q) => !answerByQuestion.has(q));
  if (missing.length) {
    console.error('❌ golden set 里引用了知识库里不存在的 FAQ 问题：', missing);
    process.exit(1);
  }

  let sum = 0;
  let n = 0;

  console.log('RAG 生成评测报告（faithfulness，1-5）');
  console.log('────────────────────────');

  for (const g of genGoldenSet) {
    const context =
      g.contextQuestions.map((q) => `【${q}】${answerByQuestion.get(q)}`).join('\n') ||
      '（未召回任何上下文）';

    const { text } = await generateText({
      model: chatModel,
      temperature: 0,
      system: GENERATION_SYSTEM,
      prompt: `知识库检索结果：
${context}

用户问题：${g.question}`,
    });

    const { value, comment } = await judgeFaithfulness({ answer: text, context });

    console.log(`\n「${g.question}」faithfulness=${value} —— ${comment}`);
    console.log(`  回答：${text.replace(/\n/g, ' ')}`);

    sum += value;
    n++;
  }

  console.log(`\n平均 faithfulness：${(sum / n).toFixed(3)}`);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
