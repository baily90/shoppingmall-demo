-- pgvector 扩展（新库首次迁移需要；若已存在则跳过）
CREATE EXTENSION IF NOT EXISTS vector;

-- 语义缓存：先去重，再建唯一索引（写入侧用 ON CONFLICT (question) upsert）
DELETE FROM "customer_service"."qa_cache" a
USING "customer_service"."qa_cache" b
WHERE a.id > b.id AND a.question = b.question;

CREATE UNIQUE INDEX IF NOT EXISTS "qa_cache_question_key"
  ON "customer_service"."qa_cache"("question");

-- TTL 清理走 created_at
CREATE INDEX IF NOT EXISTS "qa_cache_created_at_idx"
  ON "customer_service"."qa_cache"("created_at");

-- 向量索引：HNSW + 余弦距离，避免每次 FAQ/缓存检索全表扫描
CREATE INDEX IF NOT EXISTS "faq_documents_embedding_hnsw_idx"
  ON "customer_service"."faq_documents" USING hnsw ("embedding" public.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "qa_cache_embedding_hnsw_idx"
  ON "customer_service"."qa_cache" USING hnsw ("embedding" public.vector_cosine_ops);

-- 每日用量（按用户 + UTC 自然日聚合，成本控制）
CREATE TABLE "customer_service"."user_usage_daily" (
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_usage_daily_pkey" PRIMARY KEY ("user_id", "day")
);
