-- 迁移前置步骤：init_faq 迁移里的 public.vector(1024) 依赖本扩展。
-- 用法（本地/生产都适用）：
--   npx prisma db execute --file prisma/enable-pgvector.sql --schema prisma/schema.prisma
CREATE EXTENSION IF NOT EXISTS vector;
