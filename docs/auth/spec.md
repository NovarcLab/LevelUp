# Auth · 鉴权

> 最小可用 · 不自发明轮子 · Cookie session。

---

## 1. 目标

- 邮件 magic link + Google OAuth
- Lucia 管理 session
- 注册后创建 workspace · 初始化 SOUL.md / PROFILE.md

---

## 2. Schema（**只在 system.db，不在 tenant.db**）

auth 管理的所有表都在**系统库** `system.db`。tenant.db 里不存任何用户/会话数据。

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                 -- = tenantId
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER DEFAULT 0,
  tenant_dir TEXT NOT NULL,            -- tenancy.provision 写入
  timezone TEXT NOT NULL DEFAULT 'UTC',
  ai_companion_name TEXT,
  theme TEXT DEFAULT 'dark',
  plan TEXT DEFAULT 'free',
  created_at INTEGER NOT NULL,
  deleted_at INTEGER                   -- 软删除墓碑
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
  name TEXT NOT NULL,
  scopes TEXT NOT NULL,                -- JSON array
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
```

---

## 3. 端点

| Method | Path | 说明 |
|:---|:---|:---|
| `POST` | `/api/auth/magic-link` | 发送链接到邮箱 |
| `GET` | `/api/auth/verify?token=...` | 消费 token · 建 session · 重定向 |
| `GET` | `/api/auth/google` | OAuth 启动 |
| `GET` | `/api/auth/google/callback` | OAuth 回调 |
| `POST` | `/api/auth/logout` | 销毁 session |
| `GET` | `/api/auth/me` | 当前用户 |

---

## 4. Cookie

```
Name: levelup_session
HttpOnly · Secure · SameSite=Lax · Path=/
Max-Age: 30 days
```

rolling renewal：每次请求若剩余 <7d → 续期。

---

## 5. 注册后钩子

注册的核心副作用是**开租户**。tenancy 模块一次完成 provisioning：

```ts
async function onUserCreated(user: User) {
  // 创建 tenant 目录 + tenant.db + 跑 tenant migrations
  //                     + 初始化 SOUL.md / PROFILE.md / MEMORY.md
  //                     + 写回 users.tenant_dir
  const ctx = await tenancy.provision(user.id);
  tenantRegistry.release(ctx);
  // onboarding 在首次打开时接管 building 流程
}
```

**失败回滚**：provision 任一步失败 → 删目录 + 删 users 行。用户下次注册可重来。

---

## 6. 中间件

Fastify plugin：

```ts
fastify.decorateRequest('user', null);
fastify.addHook('preHandler', async (req) => {
  const sid = req.cookies.levelup_session;
  if (!sid) return;
  const session = await lucia.validateSession(sid);
  if (session?.user) req.user = session.user;
});
```

受保护路由用 `{ preHandler: requireUser }`。

---

## 7. 测试要点

- Magic link 单次消费
- OAuth 账户合并（同邮箱两次登录不创建两用户）
- Session 续期边界
- 注册触发 workspace 初始化

---

## 8. 依赖

- `lucia`
- `memory` · `persona` — 初始化钩子
- `@oslojs/crypto` — token hash
