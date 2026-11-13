# mall

综合电商练习项目（Monorepo）：Nest + Prisma + PostgreSQL 后端，React 管理端 + H5 商城端，外加一个独立的智能客服服务（RAG + 评测 + 观测）。

## 目录结构

- `apps/server`：Nest 后端（商城业务：商品 / 订单 / 营销 / 售后 / RBAC 等）
- `apps/admin`：管理端（React + Vite + Ant Design，自搭，含动态菜单 / 按钮权限）
- `apps/h5`：H5 商城（React + Vite + Ant Design Mobile，含客服入口）
- `apps/customer-service`：智能客服服务（AI SDK 7 + DeepSeek + BGE + pgvector + Langfuse）
- `packages/shared`：共享代码（类型、常量、工具）
- `docs/`：需求 / 数据库设计 / 技术选型 / 实施计划 / 阿里云部署手册

## 技术栈一览

| 层       | 选型                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 后端框架 | NestJS + Prisma + PostgreSQL + Redis + MinIO + BullMQ                               |
| 认证     | JWT 双 token：access 无状态、refresh 落 Redis 白名单（改密码/重置密码踢下线）       |
| 前端     | React 19 + Vite + Ant Design（管理端）/ Ant Design Mobile（H5）                     |
| 客服服务 | AI SDK 7 + DeepSeek（聊天）+ SiliconFlow BGE（embedding/reranker）+ pgvector（RAG） |
| 客服鉴权 | 复用 mall-server 的用户 JWT + 按用户限流                                            |
| 可观测   | pino 结构化日志（server）+ Langfuse（客服，可选）                                   |
| API 文档 | Swagger（`/docs`，`SWAGGER_ENABLED` 控制开关）                                      |

## 前置条件

- Node.js ≥ 22.5（建议 24）
- pnpm 11（项目锁定 `pnpm@11.23.0`）
- Docker Desktop（提供 PostgreSQL + Redis + MinIO；客服观测需要时再单独起 Langfuse）

## 快速开始（商城三端：后端 + 管理端 + H5）

新机器一键初始化：

```bash
pnpm setup
```

该脚本依次完成：复制 `.env` → 装依赖 → 起 Docker → 等 postgres 就绪 → 编译 shared → 建表 → 灌初始数据。

然后启动开发：

```bash
pnpm dev
```

> `pnpm dev` 会并行启动全部应用（含客服服务与 shared 的 watch）。**客服服务需先单独初始化**（见下节），否则它虽然能启动，但 `/chat` 会因缺表/缺密钥报错。只想跑商城三端时，用 `pnpm dev:server` / `dev:admin` / `dev:h5` 分别启动。

| 应用                | 地址                                                |
| ------------------- | --------------------------------------------------- |
| 后端                | http://localhost:3000/api（健康检查 `/api/health`） |
| Swagger 文档        | http://localhost:3000/docs                          |
| Bull Board 队列面板 | http://localhost:3001（开发辅助）                   |
| 管理端              | http://localhost:5173                               |
| H5                  | http://localhost:5174                               |
| 智能客服            | http://localhost:3002/health（需单独初始化）        |

**管理端登录账号**（由 seed 生成）：

| 账号     | 密码        | 角色       |
| -------- | ----------- | ---------- |
| admin    | admin123    | 超级管理员 |
| operator | operator123 | 运营       |

## 智能客服服务（可选，单独初始化）

客服服务复用商城同一个 PostgreSQL（`customer_service` schema），但需要**独立的 .env、pgvector 扩展、迁移和知识库 seed**。

### 1. 复制环境变量并填密钥

```bash
cp apps/customer-service/.env.example apps/customer-service/.env
```

在 `.env` 里填 `DEEPSEEK_API_KEY`、`SILICONFLOW_API_KEY`（embedding/reranker 用），并把 `JWT_ACCESS_SECRET` 设成与 `apps/server/.env` 一致（客服鉴权复用用户 token）。

### 2. 创建 pgvector 扩展

需先 `docker compose up -d`（商城基础设施已在跑则跳过）：

```bash
docker exec mall-postgres psql -U mall -d mall -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. 建表（客服自己的 schema）

```bash
pnpm --filter customer-service prisma:generate
pnpm --filter customer-service exec prisma migrate deploy
```

> 注意用 `migrate deploy` 而非 `prisma:migrate`（`migrate dev` 会因影子库缺 `vector` 扩展而报 `P3006`，见「常见问题」）。

### 4. 灌 FAQ 知识库（生成向量）

```bash
pnpm --filter customer-service faq:seed
```

该脚本会调用 SiliconFlow 把内置 FAQ 转成 1024 维向量写入 `faq_documents`。

### 5. 启动

```bash
pnpm --filter customer-service dev
```

健康检查：http://localhost:3002/health。H5 右下角「客服」悬浮按钮会跳转到 `/chat` 全屏聊天页（需登录）。

### 6.（可选）Langfuse 观测栈

客服服务的 trace 默认上报到 `localhost:3003`；不启动不影响功能，只是没有观测数据。需要时：

```bash
cd apps/customer-service && docker compose up -d
```

启动后访问 http://localhost:3003（compose 里有一堆 `CHANGEME` 密钥，生产前需替换）。

## 手动分步（等价于 `pnpm setup`）

### 1. 复制环境变量

`.env` 不提交 git，新机器需从模板复制一份：

```bash
cp apps/server/.env.example apps/server/.env
```

### 2. 安装依赖

```bash
pnpm install
```

> `@prisma/client` 的 postinstall 会自动执行 `prisma generate`（已在 `pnpm-workspace.yaml` 中放行）。

### 3. 启动基础设施

PostgreSQL + Redis + MinIO 由 `docker-compose.yml` 提供：

```bash
docker compose up -d
```

> 本机 Docker 不可用时，可用已安装的 Postgres.app 代替 PostgreSQL，但需确保存在 `mall` 库与 `mall`（密码 `mall123`）角色。

### 4. 编译 shared 共享包

`server` / `admin` 都依赖 `@mall/shared` 的编译产物，需先 build：

```bash
pnpm --filter @mall/shared build
```

### 5. 初始化数据库（建表）

```bash
pnpm --filter server prisma:migrate
```

### 6. 灌初始数据（RBAC seed）

```bash
pnpm --filter server prisma:seed
```

### 7. 启动开发

```bash
pnpm dev
```

## 常用命令

| 命令                                                        | 说明                                          |
| ----------------------------------------------------------- | --------------------------------------------- |
| `pnpm dev`                                                  | 并行启动全部应用（含客服服务与 shared watch） |
| `pnpm dev:server` / `dev:admin` / `dev:h5`                  | 单独启动某一端                                |
| `pnpm --filter customer-service dev`                        | 单独启动客服服务                              |
| `pnpm --filter server prisma:migrate`                       | 应用/新增商城迁移                             |
| `pnpm --filter server prisma:seed`                          | 重置 RBAC 初始数据                            |
| `pnpm --filter server prisma:studio`                        | 打开 Prisma 可视化数据面板                    |
| `pnpm --filter customer-service exec prisma migrate deploy` | 应用客服服务迁移                              |
| `pnpm --filter customer-service faq:seed`                   | 重建客服 FAQ 向量                             |
| `pnpm build` / `pnpm lint`                                  | 全量构建 / 检查                               |

## 环境变量

### server（`apps/server/.env`）

- `DATABASE_URL`、`REDIS_*`、`MINIO_*`：数据层连接
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`：双 token 密钥（access 无状态、refresh 落 Redis）
- `SWAGGER_ENABLED`：Swagger 开关（开发 `true`，生产务必 `false` / 删除）

### customer-service（`apps/customer-service/.env`）

- `DEEPSEEK_API_KEY`：聊天模型
- `SILICONFLOW_API_KEY`：embedding + reranker
- `JWT_ACCESS_SECRET`：需与 server 一致（客服鉴权复用用户 token）
- `DATABASE_URL`：复用 mall 库的 `customer_service` schema
- `MALL_SERVER_URL`：客服工具调商城接口的地址
- `LANGFUSE_*`：观测（可选）

## 常见问题

| 现象                                                                      | 原因                                                              | 解决                                               |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| 后端报 `relation "admin_user" does not exist`                             | 忘了跑迁移                                                        | `pnpm --filter server prisma:migrate`              |
| 登录提示「账号或密码错误」                                                | 忘了跑 seed                                                       | `pnpm --filter server prisma:seed`                 |
| server 报 `Cannot find module '@mall/shared'`                             | shared 没编译                                                     | `pnpm --filter @mall/shared build`                 |
| migrate 连不上数据库                                                      | Docker 没起 / postgres 未就绪                                     | `docker compose up -d` 后稍等                      |
| 端口 3000 / 5173 / 5174 / 3002 被占用                                     | 其他程序占用                                                      | 改对应 `PORT` 或释放端口                           |
| 客服 `prisma migrate dev` 报 `P3006: type "public.vector" does not exist` | 影子库缺 pgvector 扩展                                            | 改用 `prisma migrate deploy`（真实库已建扩展）     |
| 客服 `/chat` 报 401「登录已失效」                                         | `JWT_ACCESS_SECRET` 与 server 不一致，或未登录                    | 核对两边 secret 一致；H5 端登录后 token 会自动带上 |
| 客服服务里新写的 guard/provider 依赖为 `undefined`                        | 客服服务用 `tsx`(esbuild) 运行，不发射 `design:paramtypes` 元数据 | 构造注入必须显式 `@Inject(Xxx)`                    |

## 开发注意事项

- **客服服务依赖注入**：`apps/customer-service` 用 `tsx`(esbuild) 运行，不发射 `design:paramtypes`，任何带构造依赖的类都必须显式 `@Inject(Xxx)`（`apps/server` 用 tsc 无此限制）。
- **限流**：客服接口按「用户」限流（`UserThrottlerGuard`，`user:{userId}`），`/chat` 默认 10 次/分、拉历史 30 次/分。
- **鉴权**：客服只认 `type=user` 的用户 token，admin token 会被拒（401「仅限用户访问」）；会话绑定 `userId`，越权读他人会话返回 403。
