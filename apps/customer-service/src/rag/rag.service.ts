// RAG 服务：FAQ 知识库检索（embedding + pgvector 粗召回 + BGE reranker 精排）
import { Inject, Injectable } from '@nestjs/common';
import { embed, rerank } from 'ai';
import { PrismaService } from '../prisma/prisma.service.js';
import { embeddingModel, rerankModel } from '../llm/llm.service.js';

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // 检索最相关的 FAQ（topK 条）：先向量粗召回，再用 reranker 精排
  async search(question: string, topK = 3): Promise<FaqHit[]> {
    // ① 问题转向量
    const { embedding } = await embed({ model: embeddingModel, value: question });

    // ② pgvector 余弦相似度粗召回（<=> 是余弦距离，越小越相似）
    //    多召回一些候选，交给 reranker 精排
    const candidateK = topK * 5;
    const candidates = await this.prisma.$queryRaw<FaqRow[]>`
      SELECT id, question, answer, category,
             1 - (embedding OPERATOR(public.<=>) ${embedding}::public.vector) AS similarity
      FROM customer_service.faq_documents
      WHERE embedding IS NOT NULL
      ORDER BY embedding OPERATOR(public.<=>) ${embedding}::public.vector
      LIMIT ${candidateK}
    `;

    // 候选不多，无需重排
    if (candidates.length <= topK) return candidates;

    // ③ BGE reranker 精排：按 query 与问题文本的相关性重排，取 topK
    const result = await rerank({
      model: rerankModel,
      query: question,
      documents: candidates.map((c) => c.question),
      topN: topK,
    });

    // similarity 换成 rerank 的相关性分数，与最终排序保持一致
    return result.ranking.map((r) => ({ ...candidates[r.originalIndex], similarity: r.score }));
  }
}
