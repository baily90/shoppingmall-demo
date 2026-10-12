# ---------- 构建 ----------
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @mall/shared build
RUN pnpm --filter h5 build

# ---------- 运行：nginx 托管静态 + 反代 /api ----------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/h5/dist /usr/share/nginx/html
COPY apps/h5/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
