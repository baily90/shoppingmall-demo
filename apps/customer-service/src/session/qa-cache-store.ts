// 语义缓存：FAQ 问答缓存（问题向量 + 答案），命中则不调 LLM
import { Inject, Injectable } from '@nestjs/common';
import { embed } from 'ai';
import { PrismaService } from '../prisma/prisma.service.js';
import { embeddingModel } from '../llm/llm.service.js';

const SIMILARITY_THRESHOLD = 0.82;

@Injectable()
export class QaCacheStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // 查相似缓存：命中返回缓存答案，未命中返回 null（查询失败不阻塞主流程）
  async findAnswer(question: string): Promise<string | null> {
    try {
      const { embedding } = await embed({ model: embeddingModel, value: question });
      const rows = await this.prisma.$queryRaw<Array<{ answer: string; similarity: number }>>`
        SELECT answer, 1 - (embedding OPERATOR(public.<=>) ${embedding}::public.vector) AS similarity
        FROM customer_service.qa_cache
        WHERE embedding IS NOT NULL
        ORDER BY embedding OPERATOR(public.<=>) ${embedding}::public.vector
        LIMIT 1
      `;
      if (rows[0] && rows[0].similarity > SIMILARITY_THRESHOLD) {
        return rows[0].answer;
      }
      return null;
    } catch {
      return null;
    }
  }

  // 写缓存：问题转向量后连同答案一起存（写入失败不阻塞主流程）
  async saveAnswer(question: string, answer: string): Promise<void> {
    try {
      const { embedding } = await embed({ model: embeddingModel, value: question });
      await this.prisma.$executeRaw`
        INSERT INTO customer_service.qa_cache (question, answer, embedding)
        VALUES (${question}, ${answer}, ${embedding}::public.vector)
      `;
    } catch {
      // 忽略缓存写入失败
    }
  }
}
