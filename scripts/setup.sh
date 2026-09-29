#!/usr/bin/env bash
#
# 一键初始化本地开发环境（新机器 / 数据库重置后使用）
# 流程：复制 .env → 装依赖 → 起 Docker → 等 postgres 就绪 → 编译 shared → 建表 → 灌数据
#
# 用法：./scripts/setup.sh   或   pnpm setup
set -euo pipefail

cd "$(dirname "$0")/.." # 切到仓库根目录

echo "==> [1/6] 复制环境变量"
if [ -f apps/server/.env ]; then
  echo "    已存在 apps/server/.env，跳过"
else
  cp apps/server/.env.example apps/server/.env
  echo "    已生成 apps/server/.env"
fi

echo "==> [2/6] 安装依赖（会自动 prisma generate）"
pnpm install

echo "==> [3/6] 启动基础设施（PostgreSQL + Redis + MinIO）"
docker compose up -d

echo "    等待 postgres 就绪..."
ready=0
for _ in $(seq 1 30); do
  status="$(docker inspect --format='{{.State.Health.Status}}' mall-postgres 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != "1" ]; then
  echo "    postgres 30s 内未就绪，请用 docker compose logs postgres 排查" >&2
  exit 1
fi
echo "    postgres 已就绪"

echo "==> [4/6] 编译 shared 共享包"
pnpm --filter @mall/shared build

echo "==> [5/6] 建表（应用 Prisma 迁移）"
pnpm --filter server prisma:migrate

echo "==> [6/6] 灌初始数据（RBAC seed）"
pnpm --filter server prisma:seed

echo ""
echo "✅ 初始化完成。启动开发："
echo "   pnpm dev"
echo ""
echo "   管理端：http://localhost:5173   账号 admin / admin123"
echo "   后端健康检查：http://localhost:3000/api/health"
