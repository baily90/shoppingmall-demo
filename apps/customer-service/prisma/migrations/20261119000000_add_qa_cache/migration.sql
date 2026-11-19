-- 语义缓存：FAQ 问答缓存（问题向量 + 答案），命中则不调 LLM
CREATE TABLE "customer_service"."qa_cache" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "embedding" public.vector(1024),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_cache_pkey" PRIMARY KEY ("id")
);
