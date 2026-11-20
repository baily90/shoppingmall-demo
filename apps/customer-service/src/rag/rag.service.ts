// RAG 服务：FAQ 知识库检索（embedding + pgvector 粗召回 + BGE reranker 精排）
import { Inject, Injectable, Logger } from '@nestjs/common';
import { embed, rerank } from 'ai';
import { numberEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { embeddingModel, rerankModel } from '../llm/llm.service.js';

// 相关性阈值：低于阈值的候选视为「知识库没有答案」，避免把噪音上下文塞给模型
// - reranker 分数（bge-reranker-v2-m3）：相关通常 > 0.5，无关 < 0.3
// - 余弦相似度（bge-large-zh）：相关通常 > 0.6，无关 < 0.5
const MIN_RERANK_SCORE = numberEnv('RAG_MIN_RERANK_SCORE', 0.3);
const MIN_COSINE_SIMILARITY = numberEnv('RAG_MIN_COSINE_SIMILARITY', 0.55);

export interface FaqHit {
  id: number;
  question: string;
  answer: string;
  category: string;
  similarity: number;
}

interface FaqRow {
  id: number;
  question: string;
  answer: string;
  category: string;
  similarity: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // 检索最相关的 FAQ（topK 条）：先向量粗召回，再用 reranker 精排，最后按阈值过滤。
  // 没有候选过阈值时返回空数组（工具层会提示「知识库没有答案」），而不是硬塞无关文档。
  async search(question: string, topK = 3): Promise<FaqHit[]> {
    // ① 问题转向量
    const { embedding } = await embed({ model: embeddingModel, value: question });

    // ② pgvector 余弦相似度粗召回（<=> 是余弦距离，越小越相似）
    //    多召回一些候选，交给 reranker 精排
    const candidateK = Math.max(topK * 5, 10);
    const candidates = await this.prisma.$queryRaw<FaqRow[]>`
      SELECT id, question, answer, category,
             1 - (embedding OPERATOR(public.<=>) ${embedding}::public.vector) AS similarity
      FROM customer_service.faq_documents
      WHERE embedding IS NOT NULL
      ORDER BY embedding OPERATOR(public.<=>) ${embedding}::public.vector
      LIMIT ${candidateK}
    `;

    if (candidates.length === 0) return [];
    // 只有一个候选时重排没有意义，直接用余弦阈值判定
    if (candidates.length === 1) {
      return candidates.filter((c) => c.similarity >= MIN_COSINE_SIMILARITY);
    }

    // ③ BGE reranker 精排：按 query 与问题文本的相关性重排，取 topK；失败则退化为向量排序
    try {
      const result = await rerank({
        model: rerankModel,
        query: question,
        documents: candidates.map((c) => c.question),
        topN: topK,
      });
      return result.ranking
        .filter((r) => r.score >= MIN_RERANK_SCORE)
        .map((r) => ({ ...candidates[r.originalIndex], similarity: r.score }));
    } catch (e) {
      this.logger.warn(`rerank 失败，退化为向量召回：${e instanceof Error ? e.message : e}`);
      return candidates.filter((c) => c.similarity >= MIN_COSINE_SIMILARITY).slice(0, topK);
    }
  }
}
