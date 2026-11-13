-- 客服会话绑定用户：清理历史无主会话后把 user_id 设为 NOT NULL
-- （鉴权后所有会话都必须归属某个用户，历史 null 会话仅存在于开发期）

DELETE FROM "customer_service"."chat_sessions" WHERE "user_id" IS NULL;

-- AlterTable
ALTER TABLE "customer_service"."chat_sessions" ALTER COLUMN "user_id" SET NOT NULL;
