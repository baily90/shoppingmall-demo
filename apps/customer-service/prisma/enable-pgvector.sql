-- 迁移前置步骤：init_faq 迁移里的 public.vector(1024) 依赖本扩展。
-- 用法（本地/生产都适用）：
--   npx prisma db execute --file prisma/enable-pgvector.sql --schema prisma/schema.prisma
--
-- 必须显式指定 WITH SCHEMA public：Prisma 连接串带 ?schema=customer_service 时会改 search_path，
-- 不带 schema 的 CREATE EXTENSION 可能落到 customer_service 而不是 public，
-- 导致 init_faq 里的 public.vector(1024) 报「type public.vector does not exist」。
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
