# ---------- 构建 ----------
# pnpm monorepo：整仓拷贝构建。customer-service 不依赖 @mall/shared，单独构建即可。
# 注意：tsc 编译前必须先 prisma generate（src 里引用 ../generated/prisma 产物）。
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter customer-service prisma:generate
RUN pnpm --filter customer-service build

# ---------- 运行 ----------
# 整仓拷贝（含 node_modules 与 generated/prisma，稳妥但镜像偏大）
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3002
CMD ["node", "apps/customer-service/dist/main.js"]
