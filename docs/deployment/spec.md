# Deployment · Docker 部署

> 一台 VPS · 一条 `docker compose up` · 自动 HTTPS · 每日备份。

---

## 1. 目标

- 单机部署 · 无云依赖
- volume 挂载数据目录
- Caddy 反向代理 + 自动证书
- 备份与恢复流程

---

## 2. 拓扑

```
┌────────────────────────────────────────────┐
│                VPS (2c4g)                  │
│                                            │
│  ┌──────┐   ┌─────┐   ┌────────┐           │
│  │caddy │──▶│ web │   │        │           │
│  │ :443 │   │:3000│   │        │           │
│  │      │   └─────┘   │        │           │
│  │      │   ┌─────┐   │        │           │
│  │      │──▶│ api │──▶│  data  │           │
│  │      │   │:4000│   │ volume │           │
│  └──────┘   └─────┘   │        │           │
│             ┌────────┐│        │           │
│             │ worker ││        │           │
│             └────────┘└────────┘           │
└────────────────────────────────────────────┘
```

四个容器 · 一个 volume。

---

## 3. docker-compose.yml（参考骨架）

```yaml
services:
  caddy:
    image: caddy:2
    ports: ['80:80', '443:443']
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on: [web, api]

  web:
    build: { context: ., dockerfile: Dockerfile.web }
    environment:
      - API_URL=http://api:4000
      - NODE_ENV=production
    depends_on: [api]

  api:
    build: { context: ., dockerfile: Dockerfile.api }
    environment:
      - DATABASE_URL=file:/data/levelup.db
      - WORKSPACE_DIR=/data/workspaces
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    volumes:
      - ./data:/data
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:4000/healthz']
      interval: 10s

  worker:
    build: { context: ., dockerfile: Dockerfile.api }
    command: ['node', 'dist/worker.js']
    environment:
      - DATABASE_URL=file:/data/levelup.db
      - WORKSPACE_DIR=/data/workspaces
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./data:/data
    depends_on: [api]

volumes:
  caddy_data:
```

---

## 4. Dockerfile.web

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages packages/
RUN corepack enable && pnpm i --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

---

## 5. Dockerfile.api

```dockerfile
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++ sqlite-dev
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages packages/
RUN corepack enable && pnpm i --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter api build

FROM node:22-alpine AS runner
RUN apk add --no-cache sqlite
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

better-sqlite3 需要 native build → deps 层装 python/make/g++。

---

## 6. Caddyfile

```
levelup.app {
  encode zstd gzip

  @api path /api/*
  handle @api {
    reverse_proxy api:4000 {
      header_up Host {host}
      flush_interval -1           # SSE 不缓冲
    }
  }

  handle {
    reverse_proxy web:3000
  }
}
```

---

## 7. 首次启动

```bash
cp .env.example .env        # 填入 ANTHROPIC_API_KEY 等
mkdir -p data
docker compose up -d
docker compose exec api node dist/migrate.js
```

migrations 幂等 · 以后 `docker compose pull && up -d` 自动迁移。

---

## 8. 备份

由 scheduler 模块内嵌 `backup` job（每日 03:00）：

```bash
tar -czf /data/backups/levelup-$(date +%F).tar.gz \
  -C /data levelup.db workspaces
```

保留 14 天。Rclone 同步到对象存储可选。

**恢复**：

```bash
docker compose down
tar -xzf data/backups/levelup-2026-04-10.tar.gz -C data
docker compose up -d
```

---

## 9. 健康检查

- `GET /healthz` → `{ status: 'ok', dbMs, diskFreeMb, uptimeS }`
- worker 写 `data/heartbeat.txt` 每分钟 · api `/healthz` 读它检测 worker 活性

---

## 10. 日志

- 容器日志走 docker · `docker compose logs -f --tail 200`
- api 用 Pino JSON 到 stdout
- 生产环境可接 Loki / Grafana（可选）

---

## 11. 资源预算

| 组件 | CPU | RAM |
|:---|:---|:---|
| web | 0.3 core | 256 MB |
| api | 0.5 core | 512 MB |
| worker | 0.2 core | 256 MB |
| caddy | 0.1 core | 64 MB |
| **合计** | ~1.1 core | ~1.1 GB |

2c4g VPS 绰绰有余 · 10 万用户规模再考虑升级。

---

## 12. 测试要点

- 本地 `docker compose up` 走通登录 → 建档 → 对话
- 杀 api 容器 → worker 自动恢复
- 删 data 目录 → 从备份恢复一致
- SSE 在 Caddy 下首字 < 1.5s

---

## 13. 风险

| 风险 | 缓解 |
|:---|:---|
| SQLite WAL 在 Docker volume 上性能不佳 | 开启 `journal_mode=WAL` + `synchronous=NORMAL` · 实测 |
| better-sqlite3 与 alpine musl 兼容 | 若出问题切 debian-slim 基础镜像 |
| 备份时文件锁 | 用 SQLite `VACUUM INTO` 而不是直接 cp |
| Caddy 证书申请失败 | DNS 预校验 · 手动 standalone 作为 fallback |
