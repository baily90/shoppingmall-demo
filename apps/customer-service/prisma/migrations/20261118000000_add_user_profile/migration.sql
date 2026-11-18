-- 用户画像（跨会话长期记忆）：按 userId 维度存自然语言事实
CREATE TABLE "customer_service"."user_profiles" (
    "user_id" TEXT NOT NULL,
    "facts" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);
