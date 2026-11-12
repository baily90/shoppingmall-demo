-- 客服会话：消息日志（append-only）+ 会话状态（summary/水位线/slots）
-- 所有表建在 customer_service schema（与 faq_documents 一致）

CREATE SCHEMA IF NOT EXISTS "customer_service";

-- CreateTable
CREATE TABLE "customer_service"."chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_service"."chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "token_est" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_service"."chat_session_states" (
    "session_id" TEXT NOT NULL,
    "summary" TEXT,
    "summary_up_to_seq" INTEGER NOT NULL DEFAULT 0,
    "slots" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_session_states_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_session_id_seq_key" ON "customer_service"."chat_messages"("session_id", "seq");

-- AddForeignKey
ALTER TABLE "customer_service"."chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "customer_service"."chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_service"."chat_session_states" ADD CONSTRAINT "chat_session_states_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "customer_service"."chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
