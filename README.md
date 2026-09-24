# mall

综合电商练习项目：Nest + Prisma + PostgreSQL 后端，React 管理端 + H5 端。

## 目录结构

- `apps/server`：Nest 后端
- `apps/admin`：管理端（React + Vite + Ant Design）
- `apps/h5`：H5 商城（React + Vite + Ant Design Mobile）
- `packages/shared`：共享代码（类型、常量、工具）
- `docs/`：需求 / 数据库设计 / 技术选型 / 实施计划

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动基础设施

PostgreSQL + Redis + MinIO 由 `docker-compose.yml` 提供：

```bash
docker compose up -d
```

> 本机 Docker 不可用时，可用已安装的 Postgres.app 代替 PostgreSQL，但需确保存在 `mall` 库与 `mall`（密码 `mall123`）角色。

### 3. 初始化数据库（建表）

```bash
pnpm --filter server prisma:migrate
```

### 4. 启动开发

一条命令并行启动后端 + 管理端 + H5：

```bash
pnpm dev
```

| 应用   | 地址                                                |
| ------ | --------------------------------------------------- |
| 后端   | http://localhost:3000/api（健康检查 `/api/health`） |
| 管理端 | http://localhost:5173                               |
| H5     | http://localhost:5174                               |
