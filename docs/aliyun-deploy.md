# 阿里云部署手册（GitHub Actions CI/CD 全流程）

> 目标：把这个 pnpm monorepo（NestJS server + React h5/admin + @mall/shared）通过 **GitHub Actions + ACR + ECS** 从零部署上线。
> 读者定位：对服务器不熟、第一次上线的人。每一步都给出**为什么**和**具体命令/点击路径**。
> 价格会随活动变化，文中数字只是量级参考，以控制台实时价为准。

---

## 0. 最终架构（先看清全局）

```
你本地 push 代码
   │
   ▼
GitHub 代码仓库 ──► GitHub Actions（海外构建机）
                        ├─ 构建：docker build（Dockerfile 内 pnpm install + build）
                        ├─ 打镜像：3 个镜像，tag = git SHA
                        └─ push 到 ACR（mall-server / mall-h5 / mall-admin）
   │
   ▼
ECS 云服务器（Alibaba Cloud Linux 3/4）
   ├─ nginx（h5/admin 容器内，反代 /api → server:3000）
   ├─ server 容器（NestJS :3000）
   ├─ db 容器（PostgreSQL 16）
   ├─ redis 容器（Redis 7）
   └─ minio 容器（对象存储，存图片）
```

**用到的产品**：ECS + ACR（阿里云）、GitHub（代码仓 + Actions 流水线）、（可选）RDS/Redis/OSS（托管数据层）、域名 + ICP 备案。

---

## 1. 账号与资源准备

### 1.1 注册 + 实名认证
- [ ] 注册阿里云账号（个人用支付宝实名即可）。
- [ ] 完成**实名认证**——不认证买不了 ECS、也备案不了。

### 1.2 购买 ECS
- [ ] 控制台 → 云服务器 ECS → 创建实例，关键选项：

| 选项 | 建议 | 说明 |
|---|---|---|
| 地域 | 杭州 / 上海（离你近） | 地域决定 ACR、RDS 都要同地域才能内网互通 |
| 实例规格 | **2 vCPU 4 GiB** 起步，预算够上 4c8g | 你要同时跑 server + db + redis + minio + 2 个 nginx，2c4g 是底线，4c8g 更舒服 |
| 实例类型 | 突发性能型（t6/t7）练习够 | 便宜，适合低负载；别买「共享型」老实例 |
| 镜像 | **Alibaba Cloud Linux 3（或 4）** | 阿里云原生优化、自带国内源；3/4 只在装 Docker 固定源版本时不同（见 3.3） |
| 系统盘 | 云盘 ESSD 40G 起步 | 图片会进 MinIO，40G 练习够；不够以后扩容 |
| 带宽 | 固定带宽 **3~5 Mbps** | 固定带宽计费简单；按量适合流量不稳定 |
| 登录凭证 | **密钥对**（生成并保存好 .pem） | 比密码安全，也是最佳实践 |
| 安全组 | 见下一条 | 相当于云防火墙 |

- [ ] **安全组**（最容易漏、最容易连不上的地方）开放入方向端口：
  - `22`（SSH）、`80`（http）、`443`（https）
  - `8080`（h5）、`8081`（admin）、`3000`（server，临时验证用）
  - `9000`（**MinIO 图片公开访问，必须放行**——浏览器直接从这拉图）
  - 后面用 nginx 统一入口后可再收窄，练习期先放开。
  - 注意：`9001`（MinIO 控制台）**不用开**，bucket 由 server 启动时自动创建（见第 4 节）。

### 1.3 域名 + ICP 备案（大陆必需，尽早启动）
- [ ] 买一个域名（万网/阿里云域名，`.com` 约几十块/年）。
- [ ] 提交 **ICP 备案**：ECS 是大陆节点，域名走 80/443 必须备案，**周期 2~4 周**，先提交着，别等最后。
- [ ] 备案期间：**先用 `IP:端口` 直接访问验证整条链路**，不用域名也能跑通。

### 1.4 开通 GitHub + ACR
- [ ] GitHub：注册账号，新建一个**私有**仓库（代码仓；Actions 流水线也跑在 GitHub 上，个人项目免费额度够用）。
- [ ] 容器镜像服务 ACR：开**个人版**（免费额度），地域选和 ECS 一致。个人版有一个**专属地址**（形如 `crpi-xxx.cn-shanghai.personal.cr.aliyuncs.com`），在 ACR 控制台实例页能看到，下面所有 `docker login` / `REGISTRY` 都用它。

---

## 2. 代码与制品准备（本地先跑通）

> 本地能跑，部署才有意义。这一阶段大部分已经完成。

- [ ] 本地 `pnpm install`、三端 `build` 通过。
- [ ] `pnpm --filter server migrate:deploy` 能应用迁移（本地验证）。
- [ ] 存储改造已落地：DB 存图片 **key**，读取时 `toPublicUrl` 拼 `MINIO_PUBLIC_URL`（已做）。
- [x] **`docker-compose.prod.yml` 已改好**：`image:` pull 固定 tag（CI 构建、CD 只拉取）+ server 健康检查，无需再动。
- [ ] `.gitignore` 确认：`.env`、`.env.prod`、`node_modules`、`dist` 都不进 git（只留 `.env.prod.example`）。

---

## 3. ECS 初始化（第一次 SSH 进去要做的事）

### 3.1 连上服务器
- [ ] 用 Workbench（控制台网页）或本地 `ssh -i your-key.pem root@<公网IP>` 登录。

### 3.2 基础配置
> 练习期直接用 root 操作（第 3.1 步就是 root 登录），省去建普通用户这一步；以后要正式上线再补一个非 root 用户 + `wheel` 组。
```bash
# 时区（国内）
timedatectl set-timezone Asia/Shanghai

# 更新系统（Alinux 用 dnf）
dnf update -y
```

### 3.3 安装 Docker + Docker Compose（用阿里云软件源，国内快）
```bash
dnf install -y dnf-plugins-core ca-certificates curl
dnf config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo

# 关键：Alinux 的 $releasever 是 3/4，而 docker-ce 源只有 CentOS 7/8/9，不固定会 404。
# 先 cat /etc/redhat-release 看版本：Alinux 3 → 下面固定 8；Alinux 4 → 把 8 改成 9
sed -i 's|\$releasever|8|g' /etc/yum.repos.d/docker-ce.repo
dnf clean all

dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
```
验证：
```bash
docker --version && docker compose version
```

### 3.3.1 配置 Docker Hub 加速镜像（国内必做）
> 国内直连 Docker Hub 很慢甚至拉不动，`postgres`/`redis` 都从这来，不配加速后面会卡在 `docker pull`。
```bash
# 阿里云控制台 → 容器镜像服务 ACR → 镜像加速器，能拿到你专属的 <id>.mirror.aliyuncs.com 地址，最稳
# 没有的话先用公共镜像（DaoCloud 等），地址可能变，失效就换
mkdir -p /etc/docker
tee /etc/docker/daemon.json > /dev/null <<'EOF'
{
  "registry-mirrors": [
    "https://<你的阿里云加速ID>.mirror.aliyuncs.com"
  ]
}
EOF
systemctl daemon-reload && systemctl restart docker
docker info | grep -A2 'Registry Mirrors'   # 确认生效
```

### 3.4 建目录结构
```bash
mkdir -p /srv/mall
```

### 3.5 登录 ACR（让 ECS 能拉私有镜像）
```bash
docker login crpi-csvbaxkcha7nlevp.cn-shanghai.personal.cr.aliyuncs.com
# 用户名=你的阿里云账号登录名；密码=ACR 控制台「访问凭证」里设置的固定密码（见第 6 节）
```

---

## 4. 数据层与存储（自托管 vs 托管）

你的 `docker-compose.prod.yml` 里 db/redis/minio 是**容器自托管**。两条路线：

| | 自托管（容器里跑） | 托管服务（RDS/Tair/OSS） |
|---|---|---|
| 优点 | 免费、一步到位 | 有备份、免运维、高可用 |
| 缺点 | 要自己备份、单点 | 每月几十到几百块 |
| 适合 | **练习期先跑通** | 生产/数据重要后切换 |

**建议**：练习期先用自托管跑通，之后要正式运营再切托管。切换只改环境变量（`DATABASE_URL`、`REDIS_HOST`、`MINIO_*`），代码不动——这正是这次存储改造的价值。

**bucket 不用手动建**：server 启动时（`MinioStorageService.onModuleInit`）会自动 `makeBucket` 并把 bucket 设为**公开读**（匿名 `s3:GetObject`，浏览器 `<img>` 才能直接拉图）。所以：
- [x] 无需打开 MinIO 控制台、也无需手动建 bucket（9001 端口可一直不开）。
- [ ] 唯一前提：server 起之前 db/redis/minio 已就绪——compose 的 `depends_on` 已保证，不用额外操作。

---

## 5. GitHub 建仓 + push 代码

- [ ] GitHub → New repository → 建**私有**仓库（名字随意，如 `mall`），不要勾选初始化 README（保持空库，方便 push 现有仓库）。
- [ ] 本地把仓库指过去并推送（推荐 SSH，GitHub 的 SSH 用户名是标准的 `git`）：
```bash
cd /Users/zhangyanlong/Workspace/baily/mall
git remote add origin git@github.com:<你的用户名>/mall.git   # 或 https://github.com/<用户名>/mall.git
git push -u origin main
```
> 首次用 SSH 先把公钥加到 GitHub：`Settings → SSH and GPG keys → New SSH key`，贴入 `~/.ssh/id_rsa.pub` 的整行内容。验证：`ssh -T git@github.com` 应返回 `Hi <用户名>!`。
- [ ] 确认 `.env`、`.env.prod` **没有**被推上去（`git ls-files | grep -E '\.env'` 只应看到 `.env.example` 系列）。

---

## 6. ACR 建镜像仓库

- [ ] ACR 控制台 → 命名空间 → 新建 `shopping-mall`。
- [ ] 在 `shopping-mall` 命名空间下建 3 个仓库：`mall-server`、`mall-h5`、`mall-admin`（每个仓库=一个镜像名）。
- [ ] ACR 个人版 → 「**设置固定密码**」，记下用户名 + 密码 → 这是流水线和 ECS `docker login` 用的 `ACR_USER` / `ACR_PASS`。

---

## 7. GitHub Actions 建流水线（workflow 文件）

> 流水线就是一个 yaml 文件：`.github/workflows/deploy.yml`（仓库里已放好，push 到 GitHub 后自动生效）。它做四件事：检出代码 → 登录 ACR → docker build 三个镜像并 push → SSH 到 ECS 拉取并 up。

### 7.1 了解 workflow（已写好，不用手写）
`.github/workflows/deploy.yml` 流程：`push 到 main 触发` → `docker build -f apps/xxx/Dockerfile` 打 3 个镜像（Dockerfile 里自带 corepack + pnpm install + build，所以不用单独跑构建）→ `push 到 ACR` → `SSH 到 ECS 执行 compose pull + up`。

> ⚠️ 海外构建机拉 Docker Hub 基础镜像（node:24-alpine、nginx）没问题，但推镜像到国内 ACR 会慢一点，属正常，能跑通。

### 7.2 在 GitHub 里加 4 个 Secrets（敏感信息不进代码）
- [ ] GitHub 仓库 → **Settings → Secrets and variables → Actions → New repository secret**，逐个添加：
  - `ACR_USER`：阿里云账号登录名（ACR「访问凭证」页显示的克隆账号）
  - `ACR_PASS`：ACR 固定密码
  - `ECS_HOST`：ECS 公网 IP
  - `ECS_SSH_KEY`：登录 ECS 的**私钥内容**（`.pem` 文件整段贴进去）
  > JWT/数据库密码那些**不用**放这里——它们已经在 ECS 的 `.env.prod` 里，构建不依赖。

### 7.2.1（可选）用密码登录 ECS 而不是私钥
- [ ] 若本地没有 `.pem` 私钥：ECS 控制台 → 实例 → 更多 → 密码/密钥 → **重置实例密码**，设一个 root 密码。
- [ ] 然后把 `.github/workflows/deploy.yml` 部署那步的 `key: ${{ secrets.ECS_SSH_KEY }}` 换成 `password: ${{ secrets.ECS_PASSWORD }}`，并在 GitHub 里新增 `ECS_PASSWORD` secret。

### 7.3 生产文件（要在 ECS 上放对）
- [x] `docker-compose.prod.yml`：已是 `image: ${REGISTRY}/mall-xxx:${IMAGE_TAG}`（pull 版）+ server 健康检查，无需再改。
- [ ] `.env.prod`：从 `.env.prod.example` 复制，填真实值（见 8.1）。
- [ ] 两个文件放到 ECS `/srv/mall/`。**怎么传**（二选一）：
  - 本地 `scp`（在你自己 Mac 终端跑，不是 ECS 上）：
    ```bash
    cd /Users/zhangyanlong/Workspace/baily/mall
    scp docker-compose.prod.yml .env.prod.example root@<公网IP>:/srv/mall/   # 密钥登录加 -i 你的.pem
    ```
  - 或用 ECS 控制台 Workbench 网页终端的「上传文件」按钮，上传到 `/srv/mall/`。

---

## 8. 首次部署上线

### 8.1 准备 .env.prod
- [ ] 在 ECS `/srv/mall/` 执行 `cp .env.prod.example .env.prod`，改真实值。**`REGISTRY` 没有默认值、必须改成你的 ACR 地址，否则 compose 直接报 `variable REGISTRY not set`**：
```ini
REGISTRY=crpi-csvbaxkcha7nlevp.cn-shanghai.personal.cr.aliyuncs.com/shopping-mall   # 你的 ACR 个人版地址 + 命名空间
IMAGE_TAG=<git SHA>                              # 也可不写，部署时 export 覆盖（见 8.2）
DATABASE_URL="postgresql://mall:mall123@db:5432/mall?schema=public"
POSTGRES_USER=mall
POSTGRES_PASSWORD=mall123          # 换成强密码
POSTGRES_DB=mall
REDIS_HOST=redis
REDIS_PORT=6379
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin        # 换成强密码
MINIO_BUCKET=mall
MINIO_USE_SSL=false
MINIO_PUBLIC_URL=http://<你的ECS公网IP>:9000   # 图片对外地址
JWT_ACCESS_SECRET=<强随机值>
JWT_REFRESH_SECRET=<强随机值>
PORT=3000
```

### 8.2 首跑顺序
- [ ] push 代码到 GitHub 触发 Actions 自动部署，或手动首次拉取：
```bash
cd /srv/mall
export IMAGE_TAG=<git SHA>
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```
> `up -d` 会按依赖顺序自动完成：起 db/redis/minio → 跑 `migrate` 迁移 → 起 server（启动时自动建 MinIO bucket）→ 起 h5/admin。**不用手动建 bucket，也不用单独跑 migrate**。

### 8.3 验证
- [ ] `docker compose ps` 所有服务 healthy/running。
- [ ] `curl http://localhost:3000/api/home/slots` 返回 JSON。
- [ ] 浏览器访问 `http://<IP>:8080`（h5）、`http://<IP>:8081`（admin）。
- [ ] admin 登录（admin/admin123），上传一张图，确认图片能显示、DB 存的是 key。

---

## 9. 域名 + HTTPS（备案通过后）

- [ ] 域名 DNS 解析 A 记录 → ECS 公网 IP。
- [ ] 申请 SSL 证书：阿里云**免费 SSL 证书**（个人版每年 20 个），下载 Nginx 版。
- [ ] 方案 A（简单）：再起一个 nginx 容器统一入口，80 跳 443，443 反代 h5(8080)/admin(8081)。
- [ ] 方案 B：直接用 h5/admin 的 nginx 容器挂证书 + 配 443。
- [ ] 改 `MINIO_PUBLIC_URL` 为域名（如 `https://static.你的域名.com`），图片地址自动切换，DB 不用动。
  > ⚠️ 一旦页面走 HTTPS，图片也必须 HTTPS，否则浏览器拦「混合内容」。做法：给 MinIO 也配域名 + 证书（用 nginx 反代 `static.域名.com` → `minio:9000`）。练习期可先全程 HTTP，等备案下来再统一上 HTTPS。

---

## 10. 日常运维（上线后）

### 10.1 日常发布
- [ ] 改代码 → push 到 main → GitHub Actions 自动构建部署 → 完成。这就是以后每次发版的流程。

### 10.2 回滚
- [ ] GitHub Actions 历史里找到上一个成功版本，重跑（或手动改 `IMAGE_TAG` 重新 up）。

### 10.3 日志
```bash
cd /srv/mall
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f server   # 看后端日志
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f --tail=100 server
```

### 10.4 备份（自托管数据层必做）
- [ ] 数据库定时备份：
```bash
# 每天凌晨 2 点导出（可加 cron）
cd /srv/mall
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db pg_dump -U mall mall > /srv/backup/mall_$(date +%F).sql
```
- [ ] 迁移到托管 RDS 后，用 RDS 自动备份（更省心）。

### 10.5 监控告警
- [ ] 云监控（免费）：ECS CPU/内存/磁盘告警阈值。
- [ ] `docker stats` 看容器资源占用。

### 10.6 安全加固（上线后逐步做）
- [ ] SSH 改密钥登录、禁用密码登录（`/etc/ssh/sshd_config`）。
- [ ] 关掉不需要的公网端口（9001 控制台、3000 直连），只留 80/443 + 22。
- [ ] 装 `fail2ban` 防爆破。

---

## 11. 常见问题排查

| 现象 | 排查 |
|---|---|
| SSH 连不上 | 安全组没放 22；密钥权限不对（`chmod 400`） |
| docker pull 卡 | ACR 地域和 ECS 不同；没 `docker login` |
| server 起不来 | `docker logs` 看：DATABASE_URL 错 / 迁移没跑 / Redis 连不上（DB、Redis 会阻塞引导，MinIO 不会） |
| 图片 404 | `MINIO_PUBLIC_URL` 配错；9000 端口没放行（安全组） |
| 前端页面能开但接口 404 | nginx `/api/` 反代没配；server 没起 |
| Actions 构建失败 | 看 Actions 日志：ACR 登录失败（secret 配错）/ docker build 报 pnpm 或 Prisma 错 / `--frozen-lockfile` 与 lock 不一致 |

---

> 完成这个手册后，你走完的是：**本地开发 → 制品化 → 镜像仓库 → 流水线自动化 → 服务器部署 → 域名 HTTPS → 日常运维** 的完整闭环，这就是国内互联网公司上线一套服务最主流的方式。
