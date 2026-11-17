// LLM 接入：DeepSeek（聊天）+ 硅基流动 BGE（embedding + reranker）
// 统一从这里拿模型实例，方便后续替换/加观测
import { deepseek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { RerankingModelV4 } from '@ai-sdk/provider';
import type { EmbeddingModel, LanguageModel } from 'ai';

// DeepSeek 聊天模型
export const chatModel: LanguageModel = deepseek('deepseek-chat');

// 摘要压缩模型（可独立替换为更快/更省的模型，当前与 chatModel 同款）
export const compressModel: LanguageModel = deepseek('deepseek-chat');

// 硅基流动（SiliconFlow）OpenAI 兼容接口：embedding 走它
const siliconflow = createOpenAICompatible({
  name: 'siliconflow',
  baseURL: 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY,
});

// BGE embedding（1024 维，对应 pgvector 的 vector(1024)）
export const embeddingModel: EmbeddingModel = siliconflow.embeddingModel('BAAI/bge-large-zh-v1.5');

// —— reranker ——
// 硅基流动的 /rerank 不是 OpenAI 兼容协议、没有现成 provider，
// 这里按 AI SDK v4 接口实现一个最小 RerankingModelV4，交给内置 rerank() 用（顺带进观测）。
const SILICONFLOW_RERANK_URL = 'https://api.siliconflow.cn/v1/rerank';
const RERANK_MODEL_ID = 'BAAI/bge-reranker-v2-m3';

export const rerankModel: RerankingModelV4 = {
  specificationVersion: 'v4',
  provider: 'siliconflow',
  modelId: RERANK_MODEL_ID,
  async doRerank({ query, documents, topN, abortSignal }) {
    const texts =
      documents.type === 'text' ? documents.values : documents.values.map((v) => JSON.stringify(v));

    const res = await fetch(SILICONFLOW_RERANK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: RERANK_MODEL_ID, query, documents: texts, top_n: topN }),
      signal: abortSignal,
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`rerank 调用失败（${res.status}）：${detail}`);
    }

    const body = (await res.json()) as {
      id: string;
      results: Array<{ index: number; relevance_score: number }>;
    };

    return {
      ranking: body.results.map((r) => ({ index: r.index, relevanceScore: r.relevance_score })),
      response: { id: body.id, modelId: RERANK_MODEL_ID },
    };
  },
};
