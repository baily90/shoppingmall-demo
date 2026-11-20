// 语义缓存：FAQ 问答缓存（问题向量 + 答案），命中则不调 LLM
//
// 边界：
//   - 只缓存「纯政策类」回答（写入由 chat.service 判定），不缓存含个人数据/卡片的回答
//   - TTL + 唯一键 + 到期清理，避免表无限增长、旧政策答案永久命中
//   - 查询失败一律不阻塞主流程（跳过缓存）
import { Inject, Injectable, Logger } from '@nestjs/common';
import { embed } from 'ai';
import { intEnv, numberEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { embeddingModel } from '../llm/llm.service.js';

const SIMILARITY_THRESHOLD = numberEnv('QA_CACHE_SIMILARITY_THRESHOLD', 0.85);
// 缓存有效期：FAQ 政策会更新，超过 TTL 的答案不再命中
const TTL_DAYS = intEnv('QA_CACHE_TTL_DAYS', 30);
// 太长的问答不缓存（避免索引膨胀 + 缓存串味）
const MAX_QUESTION_LENGTH = intEnv('QA_CACHE_MAX_QUESTION_LENGTH', 200);
const MAX_ANSWER_LENGTH = intEnv('QA_CACHE_MAX_ANSWER_LENGTH', 2000);

@Injectable()
export class QaCacheStore {
  private readonly logger = new Logger(QaCacheStore.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // 查相似缓存：命中返回缓存答案，未命中/失败返回 null
  async findAnswer(question: string): Promise<string | null> {
    if (!question.trim() || question.length > MAX_QUESTION_LENGTH) return null;
    try {
      const { embedding } = await embed({ model: embeddingModel, value: question });
      const rows = await this.prisma.$queryRaw<Array<{ answer: string; similarity: number }>>`
        SELECT answer, 1 - (embedding OPERATOR(public.<=>) ${embedding}::public.vector) AS similarity
        FROM customer_service.qa_cache
        WHERE embedding IS NOT NULL
          AND created_at > now() - make_interval(days => ${TTL_DAYS})
        ORDER BY embedding OPERATOR(public.<=>) ${embedding}::public.vector
        LIMIT 1
      `;
      if (rows[0] && rows[0].similarity >= SIMILARITY_THRESHOLD) {
        return rows[0].answer;
      }
      return null;
    } catch (e) {
      this.logger.warn(`语义缓存查询失败（跳过缓存）：${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  // 写缓存：问题转向量后连同答案一起存；同一问题 upsert，并顺带清理过期缓存
  async saveAnswer(question: string, answer: string): Promise<void> {
    const q = question.trim();
    const a = answer.trim();
    if (!q || !a) return;
    if (q.length > MAX_QUESTION_LENGTH || a.length > MAX_ANSWER_LENGTH) return;

    try {
      const { embedding } = await embed({ model: embeddingModel, value: q });
      await this.prisma.$executeRaw`
        INSERT INTO customer_service.qa_cache (question, answer, embedding, created_at)
        VALUES (${q}, ${a}, ${embedding}::public.vector, now())
        ON CONFLICT (question) DO UPDATE
        SET answer = EXCLUDED.answer,
            embedding = EXCLUDED.embedding,
            created_at = now()
      `;
      // 概率性清理即可：delete 走 created_at 索引，成本可控
      if (Math.random() < 0.05) {
        await this.prisma.$executeRaw`
          DELETE FROM customer_service.qa_cache
          WHERE created_at < now() - make_interval(days => ${TTL_DAYS})
        `;
      }
    } catch (e) {
      this.logger.warn(`语义缓存写入失败（忽略）：${e instanceof Error ? e.message : e}`);
    }
  }
}
