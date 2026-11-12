// FAQ 灌数据脚本：把内置 FAQ 转成向量写入 pgvector
// 运行：pnpm --filter customer-service faq:seed
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/index.js';
import { embedMany } from 'ai';
import { embeddingModel } from '../src/llm/llm.service.js';
import { FAQ_SEED } from '../src/rag/faq.seed.js';

async function seed() {
  const prisma = new PrismaClient();

  console.log(`🔄 正在为 ${FAQ_SEED.length} 条 FAQ 生成向量…`);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: FAQ_SEED.map((f) => f.question),
  });

  console.log(`   embedding 维度：${embeddings[0]?.length}`);

  // 清空旧数据，重新写入
  await prisma.$executeRaw`TRUNCATE customer_service.faq_documents RESTART IDENTITY`;

  for (let i = 0; i < FAQ_SEED.length; i++) {
    const f = FAQ_SEED[i];
    await prisma.$executeRaw`
      INSERT INTO customer_service.faq_documents (question, answer, category, embedding, created_at, updated_at)
      VALUES (${f.question}, ${f.answer}, ${f.category}, ${embeddings[i]}::public.vector, now(), now())
    `;
  }

  console.log(`✅ 已写入 ${FAQ_SEED.length} 条 FAQ`);
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('❌ 灌数据失败：', err);
  process.exit(1);
});
