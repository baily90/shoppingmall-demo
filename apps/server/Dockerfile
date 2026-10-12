# ---------- 构建 ----------
# pnpm monorepo：整仓拷贝构建。@mall/shared 先构建（tsup → dist），server 再引用其产物。
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mall/shared build
RUN pnpm --filter server prisma:generate
RUN pnpm --filter server build

# ---------- 运行 ----------
# 整仓拷贝（含 node_modules，稳妥但镜像偏大；后续可用 pnpm deploy --prod 瘦身）
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "apps/server/dist/main.js"]
