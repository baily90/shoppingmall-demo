# mall

综合电商练习项目：Nest + Prisma + PostgreSQL 后端，React 管理端 + H5 端。

## 目录结构

- `apps/server`：Nest 后端
- `apps/admin`：管理端（React + Vite + Ant Design）
- `apps/h5`：H5 商城（React + Vite + Ant Design Mobile）
- `packages/shared`：共享代码（类型、常量、工具）
- `docs/`：需求 / 数据库设计 / 技术选型 / 实施计划

## 前置条件

- Node.js ≥ 20（建议 24）
- pnpm 11（项目锁定 `pnpm@11.23.0`）
- Docker Desktop（提供 PostgreSQL + Redis + MinIO）

## 快速开始（新机器一键初始化）

```bash
pnpm setup
```

该脚本会依次完成：复制 `.env` → 装依赖 → 起 Docker → 等 postgres 就绪 → 编译 shared → 建表 → 灌初始数据。

然后启动开发：

```bash
pnpm dev
```

| 应用   | 地址                                                |
| ------ | --------------------------------------------------- |
| 后端   | http://localhost:3000/api（健康检查 `/api/health`） |
| 管理端 | http://localhost:5173                               |
| H5     | http://localhost:5174                               |

**管理端登录账号**（由 seed 生成）：

| 账号     | 密码        | 角色       |
| -------- | ----------- | ---------- |
| admin    | admin123    | 超级管理员 |
| operator | operator123 | 运营       |

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

一条命令并行启动后端 + 管理端 + H5：

```bash
pnpm dev
```

## 常用命令

| 命令                                       | 说明                       |
| ------------------------------------------ | -------------------------- |
| `pnpm dev`                                 | 并行启动三端（开发）       |
| `pnpm dev:server` / `dev:admin` / `dev:h5` | 单独启动某一端             |
| `pnpm --filter server prisma:migrate`      | 应用/新增数据库迁移        |
| `pnpm --filter server prisma:seed`         | 重置 RBAC 初始数据         |
| `pnpm --filter server prisma:studio`       | 打开 Prisma 可视化数据面板 |
| `pnpm build` / `pnpm lint`                 | 全量构建 / 检查            |

## 常见问题

| 现象                                          | 原因                          | 解决                                  |
| --------------------------------------------- | ----------------------------- | ------------------------------------- |
| 后端报 `relation "admin_user" does not exist` | 忘了跑迁移                    | `pnpm --filter server prisma:migrate` |
| 登录提示「账号或密码错误」                    | 忘了跑 seed                   | `pnpm --filter server prisma:seed`    |
| server 报 `Cannot find module '@mall/shared'` | shared 没编译                 | `pnpm --filter @mall/shared build`    |
| migrate 连不上数据库                          | Docker 没起 / postgres 未就绪 | `docker compose up -d` 后稍等         |
| 端口 3000 / 5173 被占用                       | 其他程序占用                  | 改 `PORT` 或释放端口                  |
