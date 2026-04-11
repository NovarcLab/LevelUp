# Tenancy · 多租户数据隔离

> 每个用户是一个独立租户。物理隔离 · 文件系统级。
> 一个用户的数据损坏、泄漏、被误查，都不可能扩散到另一个用户。

---

## 1. 目标

- **数据库物理隔离**：每个租户一个独立的 SQLite 文件
- **文件系统物理隔离**：每个租户一个独立的 workspace 目录
- **进程级租户上下文**：每次请求绑定 tenantId，跨租户查询在类型系统中不可能
- **导出 / 删除即 tar / rm**：一条命令完成，无需理解 schema
- **故障半径 = 单租户**：一个 db 损坏不影响其他人

**非目标**
- 不做多租户共享数据库 + row-level security（故障面太大 · 导出删除繁琐）
- 不做 schema-per-tenant（Postgres 思路，对 SQLite 无意义）
- 不做跨租户分析（如需 BI，走 ETL 抽到只读聚合库）

---

## 2. 拓扑

```
data/
├── system.db                          ← 系统库：用户路由 · session · oauth · mcp token
├── tenants/
│   └── {tenantId}/                    ← 租户根目录（= 用户根目录）
│       ├── tenant.db                  ← 租户私有 SQLite（goals · messages · ...）
│       ├── SOUL.md                    ← persona
│       ├── PROFILE.md                 ← memory L1
│       ├── GOALS.md                   ← memory L2 镜像
│       ├── MEMORY.md                  ← memory 长期索引
│       ├── digests/                   ← memory L3
│       ├── trends/                    ← memory L4
│       ├── vectors/
│       │   └── memory.sqlite          ← sqlite-vec 嵌入
│       ├── onboarding.json
│       └── locks/
├── backups/
│   └── {date}/
│       ├── system.db
│       └── tenants/
└── exports/
    └── {tenantId}-{ts}.tar.gz
```

`tenantId` 与 `user.id` 一对一（本系统中两者等价；"tenant" 留作未来 team/多人版本的扩展点）。

---

## 3. 数据库分层

### 3.1 system.db（系统库 · 全局唯一）

**只装路由与鉴权数据**，不装业务数据：

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                 -- = tenantId
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER DEFAULT 0,
  tenant_dir TEXT NOT NULL,            -- 绝对路径，方便物理迁移
  timezone TEXT NOT NULL DEFAULT 'UTC',
  theme TEXT DEFAULT 'dark',
  plan TEXT DEFAULT 'free',
  created_at INTEGER NOT NULL,
  deleted_at INTEGER                   -- 软删除墓碑（30 天后物理清除）
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE oauth_accounts (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (provider, provider_user_id)
);

CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,                  -- "MacBook Claude Code"
  scopes TEXT NOT NULL,                -- JSON array
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
```

system.db **从不**存 goal / message / digest。它只回答"这个 email 是谁"和"这个 token 属于哪个 tenantId"。

### 3.2 tenant.db（租户库 · 每租户一个）

所有业务数据：

```sql
-- 完整的 goals / milestones / actions / implementation_intentions
-- 完整的 conversations / messages / messages_fts
-- profile (单行缓存，权威仍在 PROFILE.md)
-- tenant_meta (schema_version · created_at · last_vacuum_at)
```

**tenant.db 里没有 user_id 字段**——因为整个库只属于一个用户，user_id 是隐含的。这是物理隔离带来的红利：**不可能写出 "SELECT ... WHERE user_id = ?" 的跨租户 bug**，因为连列都没有。

### 3.3 vectors/memory.sqlite（向量库 · 每租户独立）

sqlite-vec 索引，schema 由 memory 模块管理。同样不含 user_id 字段。

---

## 4. TenantContext（进程内的强制绑定）

### 4.1 类型

```ts
export interface TenantContext {
  readonly tenantId: string;
  readonly tenantDir: string;            // 绝对路径
  readonly db: Database;                 // 租户 SQLite 连接
  readonly vectors: VectorStore;         // 租户向量库
  readonly workspace: WorkspaceFs;       // 租户文件系统封装
}
```

**所有业务代码只接受 `TenantContext`，不接受 `userId`**。一旦拿到 ctx，就进入该租户的隔离沙盒。

### 4.2 获取方式

```ts
// Fastify plugin
fastify.decorateRequest('tenant', null);
fastify.addHook('preHandler', async (req) => {
  const user = req.user;                          // auth 已设
  if (!user) return;
  req.tenant = await tenantRegistry.acquire(user.id);
});
fastify.addHook('onResponse', async (req) => {
  if (req.tenant) tenantRegistry.release(req.tenant);
});
```

**业务 handler 只认 `req.tenant`，从不使用 `req.user.id` 去查业务数据**。

### 4.3 静态保证

- `Database` 类型是 branded type：`type TenantDb = Database & { __tenant: true }`
- goal-tree / conversation / memory 的函数签名都要求 `TenantContext` 或 `TenantDb`
- 想写一句"查 user_id = X"的 SQL 在类型上就通不过——因为表里没有 user_id 列

---

## 5. TenantRegistry（连接池与生命周期）

```ts
export interface TenantRegistry {
  acquire(tenantId: string): Promise<TenantContext>;
  release(ctx: TenantContext): void;
  evict(tenantId: string): Promise<void>;         // 删除用户后
  stats(): RegistryStats;
}
```

### 5.1 连接缓存

- LRU 缓存最多 N 个 open tenant.db（默认 256）
- 超出 LRU → 关闭最久未用连接
- 每连接打开时设置 pragma：
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  ```

### 5.2 锁

每个 tenantId 有一把内存 async-mutex，写操作串行化。worker 与 api 通过文件锁共享：

```
data/tenants/{id}/locks/write.lock
```

### 5.3 首次 acquire

- 若 tenantId 目录不存在 → 抛 `TenantNotFound`（acquire 不负责创建）
- 创建在 `tenantRegistry.provision(tenantId)` 里：建目录 · 建 tenant.db · 跑 migrations · 写初始 md 文件

---

## 6. Provisioning（创建租户）

auth 模块在 `onUserCreated` 调用：

```ts
await tenantRegistry.provision(user.id);
```

流程：

```
1. mkdir -p data/tenants/{id}/{digests,trends,vectors,locks}
2. create data/tenants/{id}/tenant.db
3. run tenant migrations (drizzle)
4. create data/tenants/{id}/vectors/memory.sqlite
5. persona.initSoul(ctx)         → SOUL.md
6. memory.initProfile(ctx)       → PROFILE.md · MEMORY.md
7. UPDATE system.db users SET tenant_dir = ?
```

整个 provision 在一个事务 + 文件 rename 组合里，**任一步失败全部回滚**（删目录、删 system.db 行）。

---

## 7. Deprovisioning（删除租户）

settings 一键删除 / 定时清理软删除墓碑：

```
1. tenantRegistry.evict(id)                   ← 关闭 LRU 中的连接
2. rm -rf data/tenants/{id}
3. DELETE FROM system.db sessions WHERE user_id = ?
4. DELETE FROM system.db mcp_tokens WHERE user_id = ?
5. DELETE FROM system.db oauth_accounts WHERE user_id = ?
6. DELETE FROM system.db users WHERE id = ?
```

**一次 rm -rf** 就删光业务数据。这是物理隔离的最大红利。

---

## 8. 迁移与备份

### 8.1 Schema 迁移

- `migrations/system/` — 系统库 migration
- `migrations/tenant/` — 租户库 migration
- 启动时系统库先跑完 migration
- 每个 tenant.db 在 `acquire` 时比对 `tenant_meta.schema_version` → 落后则跑 migration

**关键**：tenant migration 必须是纯函数，不依赖 env、不依赖跨租户状态，便于并行执行。

### 8.2 备份

```
backup-{date}/
├── system.db                    ← VACUUM INTO
└── tenants/
    └── {id}/
        ├── tenant.db            ← VACUUM INTO
        ├── vectors/memory.sqlite
        └── *.md / digests/ ...
```

- 用 SQLite `VACUUM INTO` 热备份，不需要停服
- `.md` 文件直接 `cp -a`
- 每日 03:00 由 scheduler 跑
- 保留 14 天

### 8.3 单租户导出

```ts
memory.exportAll(ctx) →
  tar -czf exports/{id}-{ts}.tar.gz \
    -C data/tenants {id}
```

用户可随时下载自己的 tar，包含 tenant.db + 所有 md + 向量。

### 8.4 单租户恢复

```bash
docker compose exec api node scripts/restore-tenant.js \
  --tenant-id {id} --from exports/{id}-{ts}.tar.gz
```

---

## 9. 跨租户操作的白名单

只有以下场景允许触碰多个 tenant：

| 操作 | 执行者 | 限制 |
|:---|:---|:---|
| scheduler 遍历所有活跃 tenant 做周聚合 | worker | 按 tenantId 串行 · 每个 tenant 独立 acquire/release |
| 备份 | worker | 只读 · VACUUM INTO |
| 管理工具 `admin list-tenants` | CLI | 只读 system.db |
| 管理工具 `admin delete-tenant` | CLI | 走 deprovision 流程 |

**api 的任何业务 handler 都不能遍历多 tenant**。代码审查硬性规则。

---

## 10. 安全约束

### 10.1 路径穿越防御

```ts
function tenantDir(tenantId: string): string {
  if (!/^[a-z0-9_-]{8,}$/.test(tenantId)) throw new InvalidTenantId();
  const p = path.join(DATA_ROOT, 'tenants', tenantId);
  assert(p.startsWith(path.join(DATA_ROOT, 'tenants') + path.sep));
  return p;
}
```

所有文件读写走 `WorkspaceFs` 封装，内部 join 前再 normalize + 断言前缀。

### 10.2 静态扫描

- eslint 规则：业务模块（goal-tree / conversation / memory / persona / card）禁止 import `system.db`
- eslint 规则：业务模块禁止拼接原始路径，必须用 `ctx.workspace.join(...)`

### 10.3 审计日志

admin 工具的每次调用写 `data/audit.jsonl`，包含操作者、目标 tenant、时间。

---

## 11. 性能预估

| 指标 | 值 |
|:---|:---|
| 单 tenant.db 大小（1 年重度用户） | ~20 MB |
| 1 万租户总磁盘 | ~200 GB + workspaces |
| open 连接内存 | ~2 MB/连接 × 256 LRU = ~500 MB |
| acquire 冷启动 | < 20 ms（打开 + pragma） |
| acquire 热命中 | < 0.1 ms |
| 文件数压力 | tenants/ 下每目录 1 个 · Linux ext4 无压力 |

10 万租户规模：开始分片 `tenants/{shard}/{id}/`（用 tenantId 前两位做 shard），不改代码逻辑。

---

## 12. 失败模式

| 故障 | 影响 | 恢复 |
|:---|:---|:---|
| 某 tenant.db 损坏 | 仅该用户受影响 | 从最近备份 restore 单租户 |
| system.db 损坏 | 登录失败 · 业务数据不丢 | 从备份 restore system.db · tenant 数据原样 |
| 磁盘写满 | 写操作失败 · 读正常 | 扩盘 · scheduler 触发老 digest 归档 |
| 连接 LRU 争用 | 少数请求冷启动慢 | 调大 LRU 容量 |
| 并发写同一 tenant | 被 mutex 串行化 · 延迟升高 | 延迟 <50ms 可接受 |

---

## 13. 测试要点

- **隔离性测试**：随机两个 tenant · 互相的 API 调用无论如何都拿不到对方数据
- **provisioning 失败**：每步注入错误 → 回滚后 system.db 无孤儿行 · 文件系统无残余
- **路径穿越**：`tenantId = "../other"` → 拒绝
- **并发 acquire**：100 并发请求同一 tenant · LRU 只开一个连接
- **deprovision**：删除后 acquire 抛 `TenantNotFound` · 磁盘干净
- **migration**：在 50 个 tenant.db 上并行跑 migration · 全部成功
- **备份/恢复**：备份 → 删 → 恢复 → 数据等价

---

## 14. 与既有模块的接口变更

| 模块 | 变更 |
|:---|:---|
| auth | `onUserCreated` 调 `tenantRegistry.provision` |
| memory | 所有接口参数从 `userId: string` 改为 `ctx: TenantContext` |
| persona | 同上 |
| goal-tree | 所有查询通过 `ctx.db`，不再有 `WHERE user_id = ?` |
| conversation | 同上 |
| card / context / llm | 继续接收 `ctx` |
| scheduler | 遍历 users 表 · 对每个 tenant `acquire → do → release` |
| settings | `DELETE /api/settings/account` 触发 `tenantRegistry.deprovision` |
| deployment | data 目录结构更新 · 备份脚本改 |

---

## 15. 依赖

- `better-sqlite3`
- `proper-lockfile`
- `lru-cache`
