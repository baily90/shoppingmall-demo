// 离线检索评测：golden set → 跑 ragService.search → 算 Hit@k / MRR / Recall@k
// 跑法：pnpm --filter customer-service rag-eval
//
// 只测「检索」这一段（embedding → pgvector 粗召回 → reranker 精排），
// 不经过 chat、不花 LLM 裁判的钱。改 embedding 模型、调 rerank、改 topK，
// 都先跑这个看检索质量涨跌，再决定要不要上端到端评测。
//
// 注意：这里不 import ../llm/langfuse.js，也不跑 Langfuse experiment——
// 检索评测是纯离线指标计算，结果直接打在这张报告里，不写进 Langfuse。
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { RagService } from '../rag/rag.service.js';

// 检索 golden set：query → 应召回的 FAQ 问题文本。
// 按问题文本（而非自增 id）引用，不受 seed 顺序变化影响；expected 为空 = 知识库没有答案，
// 理想情况应召回不到（用来观察误召回 / 假阳性）。
const goldenSet: Array<{ query: string; expected: string[] }> = [
  // —— 直接命中类（query 即 FAQ 原题）——
  { query: '怎么申请退款？', expected: ['怎么申请退款？'] },
  { query: '已发货的订单怎么退货？', expected: ['已发货的订单怎么退货？'] },
  { query: '退款多久到账？', expected: ['退款多久到账？'] },
  { query: '怎么查物流？', expected: ['怎么查物流？'] },
  { query: '多久发货？', expected: ['多久发货？'] },
  { query: '优惠券过期了还能用吗？', expected: ['优惠券过期了还能用吗？'] },
  { query: '怎么开发票？', expected: ['怎么开发票？'] },
  { query: '商品有质量问题怎么办？', expected: ['商品有质量问题怎么办？'] },
  { query: '能改收货地址吗？', expected: ['能改收货地址吗？'] },
  { query: '商品降价了能退差价吗？', expected: ['商品降价了能退差价吗？'] },
  { query: '退货的运费谁承担？', expected: ['退货的运费谁承担？'] },
  { query: '7 天无理由退货的条件？', expected: ['7 天无理由退货的条件？'] },
  // —— 口语 / 改写类（考 embedding 的鲁棒性）——
  { query: '东西寄回去了运费谁出', expected: ['退货的运费谁承担？'] },
  { query: '退款一般几天能到', expected: ['退款多久到账？'] },
  { query: '券过期了咋办', expected: ['优惠券过期了还能用吗？'] },
  // —— 易混项（hard negative，考区分度）——
  { query: '退货要多久', expected: ['已发货的订单怎么退货？'] },
  { query: '质量问题运费谁出', expected: ['商品有质量问题怎么办？'] },
  // —— 无答案类（知识库没有，理想应召回不到）——
  { query: '运费险怎么用', expected: [] },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const ragService = app.get(RagService);

  const topK = 3;
  const withAnswer = goldenSet.filter((g) => g.expected.length > 0);
  const noAnswer = goldenSet.filter((g) => g.expected.length === 0);

  let hit1 = 0;
  let hit3 = 0;
  let mrrSum = 0;
  let recallSum = 0;
  const missed: string[] = [];

  for (const g of withAnswer) {
    const hits = await ragService.search(g.query, topK);
    const hitQuestions = hits.map((h) => h.question);

    // Hit@k：top-k 里有没有命中（任一 expected）
    const hit = hitQuestions.slice(0, topK).filter((q) => g.expected.includes(q));
    if (hit.length > 0) hit3++;
    if (g.expected.includes(hitQuestions[0])) hit1++;

    // MRR：正确文档首次出现的排名的倒数
    let rank = 0;
    for (let i = 0; i < hitQuestions.length; i++) {
      if (g.expected.includes(hitQuestions[i])) {
        rank = i + 1;
        break;
      }
    }
    mrrSum += rank === 0 ? 0 : 1 / rank;

    // Recall@k：期望命中的文档里，有多少落进了 top-k
    const recalled = g.expected.filter((q) => hitQuestions.slice(0, topK).includes(q)).length;
    recallSum += recalled / g.expected.length;

    if (hit.length === 0) {
      missed.push(
        `「${g.query}」应召回[${g.expected.join(' / ')}]，实际 top3=[${hitQuestions.join(' | ')}]`,
      );
    }
  }

  const n = withAnswer.length;
  console.log('RAG 检索评测报告');
  console.log('────────────────────────');
  console.log(`有答案 query 数：${n}（另有 ${noAnswer.length} 条无答案类单独看）`);
  console.log(`Hit@1:      ${(hit1 / n).toFixed(3)}`);
  console.log(`Hit@3:      ${(hit3 / n).toFixed(3)}`);
  console.log(`MRR:        ${(mrrSum / n).toFixed(3)}`);
  console.log(`Recall@${topK}:   ${(recallSum / n).toFixed(3)}`);

  if (missed.length) {
    console.log('\n❌ 未命中的 query：');
    for (const m of missed) console.log(`  - ${m}`);
  }

  if (noAnswer.length) {
    console.log('\n⚠️  无答案类（知识库没有，理想应召回不到）：');
    for (const g of noAnswer) {
      const hits = await ragService.search(g.query, 1);
      console.log(`  - 「${g.query}」→ 实际 top1=[${hits.map((h) => h.question).join(' | ')}]`);
    }
  }

  await app.close();
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
