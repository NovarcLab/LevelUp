# MCP Server · 开放给本地 Claude Code 的接口

> 用户可以在本地的 Claude Code（或任何 MCP 客户端）通过 token 鉴权访问自己的目标树、进度与记忆。
> 这是 LevelUp 第一个对外开放接口。

---

## 1. 目标

- 用户在 Settings → Integrations 生成 MCP token
- Claude Code 配置 MCP server 指向 `https://levelup.app/mcp`
- 鉴权后按 **tenant 严格隔离**，只能访问 token 所属租户的数据
- 提供只读与有限写操作的 **tools**，不暴露原始 SQL

**非目标**
- 不做 OAuth2 动态注册（先用静态 bearer token · 简单安全）
- 不做 MCP prompts 或 resources subscription（MVP 只上 tools）
- 不做第三方应用商店式授权

---

## 2. 什么是 MCP

**Model Context Protocol** — Anthropic 提出的开放协议，让 LLM 客户端（Claude Code / Claude Desktop / 第三方）以统一方式连接外部数据与工具。协议细节以官方 SDK `@modelcontextprotocol/sdk` 为准。

LevelUp 作为 **MCP server** 实现：
- **Tools**：LLM 可调用的函数（如 `list_active_goals`）
- **Resources**：可读取的数据块（如 `goals://active`）
- **Transports**：支持 HTTP + SSE（remote）和 stdio（本地代理，可选）

---

## 3. 鉴权

### 3.1 Token 模型

```sql
-- system.db
CREATE TABLE mcp_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,     -- SHA-256, 原文不存
  name TEXT NOT NULL,
  scopes TEXT NOT NULL,                -- JSON: ["goals:read","progress:write",...]
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
```

### 3.2 生成

用户在 settings 点击"New MCP token"：

```
Name: MacBook Claude Code
Scopes: [✓] goals:read  [✓] progress:write  [ ] memory:read
[create]
```

服务器生成 token：

```
mcp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**只显示一次**，用户复制后不再可见，失落只能删除重建。存 token 的 SHA-256 hash。

### 3.3 使用

客户端 HTTP header：

```
Authorization: Bearer mcp_live_xxxxxxxxxxxx
```

服务端 preHandler：

```ts
const hash = sha256(token);
const row = await systemDb.query.mcpTokens.findFirst({ where: eq(tokenHash, hash) });
if (!row || row.revokedAt) throw 401;
req.tenant = await tenantRegistry.acquire(row.userId);
req.scopes = JSON.parse(row.scopes);
systemDb.update(mcpTokens).set({ lastUsedAt: now }).where(eq(id, row.id));
```

**关键**：MCP 请求进入后续业务的路径和 web session 请求**完全一致**——都走 `TenantContext`。不存在"MCP 专用查询"。

### 3.4 撤销

Settings → revoke → `UPDATE mcp_tokens SET revoked_at = now()`。撤销后下次请求即 401。

---

## 4. Scopes

最小权限原则。粒度与租户内资源对齐：

| Scope | 含义 |
|:---|:---|
| `goals:read` | 读目标树 · 里程碑 · 行动 |
| `progress:read` | 读最近行动状态 · 进度百分比 |
| `progress:write` | 标记行动完成 · 记录进展 |
| `memory:read` | 读 profile · 最近 digests · trends |
| `conversation:send` | 从外部向主对话发送一条消息（类似"浏览器插件"） |

**默认只勾选 `goals:read` + `progress:read`**，写权限必须用户显式授权。

---

## 5. Tools（MVP）

每个 tool 对应 `@modelcontextprotocol/sdk` 的 `server.tool(name, schema, handler)`。

### 5.1 `list_active_goals`

**scope**: `goals:read`

```ts
input: {}
output: {
  goals: Array<{
    id: string;
    title: string;
    percent: number;
    status: 'active' | 'at-risk' | 'stuck' | 'near-done';
    currentMilestone: string | null;
    updatedAt: string;
  }>
}
```

实现直接调 `goalTree.activeSnapshot(ctx)`。

### 5.2 `get_goal`

**scope**: `goals:read`

```ts
input: { goalId: string }
output: {
  id: string; title: string; whyStatement: string;
  milestones: Array<{...}>;
  currentActions: Array<{...}>;
  implementationIntention: {...} | null;
}
```

### 5.3 `list_week_actions`

**scope**: `progress:read`

```ts
input: { weekOf?: string }        // ISO week · 默认本周
output: {
  weekOf: string;
  actions: Array<{
    id: string; title: string;
    goalTitle: string; milestoneTitle: string;
    status: 'pending' | 'in_progress' | 'done' | 'skipped';
    dueHint: string | null;
  }>
}
```

### 5.4 `mark_action_done`

**scope**: `progress:write`

```ts
input: { actionId: string; note?: string }
output: { ok: true; goalPercent: number }
```

内部调 `goalTree.markActionDone` + 若 note 非空则作为一条 system 消息写入主对话的 context（不触发 LLM 回复，仅留痕）。

### 5.5 `log_progress`

**scope**: `progress:write`

```ts
input: { goalId: string; text: string }
output: { ok: true; digestId: string }
```

把一段自由文本当作一条"外部进展"记入 digest L3：

- 创建一个 synthetic conversation：`source='mcp'`
- 写入一条 user message + AI 简短确认（不调 LLM，用模板）
- 触发 digestWriter 生成 digest
- 在主对话下次打开时作为"最近进展"浮现

### 5.6 `get_recent_digests`

**scope**: `memory:read`

```ts
input: { limit?: number }            // 默认 7
output: {
  digests: Array<{
    segmentId: string;
    date: string;
    topic: string;
    progress: string;
    mood: string;
    openQuestions: string[];
  }>
}
```

### 5.7 `send_message`（P1）

**scope**: `conversation:send`

```ts
input: { text: string; contextGoalId?: string }
output: { messageId: string }
```

等价于在 web 里敲一条消息，会走完整 context → llm → memory 流水线。谨慎开放。

---

## 6. Resources（可选 · P1）

MCP resources 是"可被列出和读取的数据块"，对应 URI schema：

```
goals://active               → 等价 list_active_goals 的 JSON
goals://{goalId}             → 等价 get_goal
memory://profile             → PROFILE.md 原文
memory://digests/2026-04-11  → digests/2026-04-11.md 原文
trends://week/{isoWeek}      → trends/week-{isoWeek}.md 原文
```

Claude Code 可"附加"这些 resource 到对话上下文，像引用本地文件一样引用 LevelUp 数据。

---

## 7. 传输层

### 7.1 HTTP + SSE（远程，默认）

- 端点：`POST /mcp`（JSON-RPC 请求） · `GET /mcp/events`（SSE 订阅）
- 按 MCP 规范处理 `initialize` · `tools/list` · `tools/call` · `resources/list` · `resources/read`
- 持 bearer token 的长连接

### 7.2 stdio proxy（本地，P1）

发布一个 npm 包 `@levelup/mcp-proxy`：

```bash
npx @levelup/mcp-proxy --token mcp_live_xxx
```

它在本地 spawn 一个 stdio server，把 stdio 消息转 HTTPS 到 `levelup.app/mcp`。对用户的好处：Claude Code 的 MCP 配置可以写本地命令而不是 URL，绕过某些网络限制。

Claude Code 配置：

```json
{
  "mcpServers": {
    "levelup": {
      "command": "npx",
      "args": ["-y", "@levelup/mcp-proxy", "--token", "mcp_live_xxx"]
    }
  }
}
```

---

## 8. Rate limit 与配额

per token：

| 类 | 限制 |
|:---|:---|
| 读 tool | 60 次 / 分钟 |
| 写 tool | 20 次 / 分钟 |
| `send_message` | 10 次 / 分钟 |

实现：进程内 token-bucket · 超限返回 MCP 错误 `rate_limited`。

---

## 9. 审计

每次 tool 调用写 `data/tenants/{id}/mcp-audit.jsonl`：

```json
{ "ts": 1712825400, "tokenId": "t_abc", "tool": "mark_action_done", "args": {...}, "ok": true }
```

在 Settings → Integrations → {token} → Activity 可查看。用户对自己的 MCP 调用历史完全可见。

---

## 10. Settings UI

新增 section：**Integrations**

```
┌────────────────────────────────────────────────┐
│  INTEGRATIONS                                  │
│                                                │
│  MCP TOKENS                                    │
│                                                │
│  ▪  MacBook Claude Code                        │
│     Created · 2026-04-01                       │
│     Last used · 2 hours ago                    │
│     Scopes · goals:read, progress:write        │
│     [Activity]  [Revoke]                       │
│                                                │
│  ▪  iPad Claude                                │
│     Created · 2026-03-28                       │
│     Never used                                 │
│     Scopes · goals:read                        │
│     [Activity]  [Revoke]                       │
│                                                │
│  [+ New token]                                 │
│                                                │
│  ──────────────────────────────────────────    │
│                                                │
│  HOW TO USE                                    │
│  1. Copy the token after creation (once)      │
│  2. Add to your Claude Code settings           │
│  3. Your companion will be accessible as a     │
│     tool inside Claude Code.                   │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 11. 测试要点

- **隔离**：token A 只能访问 tenant A 的数据（构造两 token，互相请求对方 goalId → 404）
- **scope 校验**：`progress:write` 缺失时 `mark_action_done` → 403
- **撤销立即生效**：撤销后下一次请求 401
- **rate limit**：超配额返回 rate_limited
- **path 穿越**：resource URI 注入 `../` → 拒绝
- **stdio proxy**：本地跑通 list → call → read 全链路
- **MCP 规范一致性**：用官方 inspector 走 `initialize` · `tools/list` · `tools/call`

---

## 12. 风险

| 风险 | 缓解 |
|:---|:---|
| Token 泄漏 | 可随时撤销 · 审计可追 · 只显示一次 |
| 外部修改导致主对话上下文错乱 | `log_progress` 走正规 digest 流程 · 主对话能看到来源标记 |
| MCP 客户端滥用写权限 | 默认只读 · 写权限用户手动授权 · rate limit |
| MCP 协议升级 | 钉死 SDK minor 版本 · 订阅 Anthropic changelog |
| 长连接资源占用 | SSE 空闲 5 分钟断开 · 重连即可 |

---

## 13. 依赖

- `@modelcontextprotocol/sdk`
- `tenancy` — TenantContext · TenantRegistry
- `goal-tree` · `memory` · `conversation` — 业务能力
- `auth` — token hash · 账户关联
- `settings` — UI 管理

---

## 14. Phase 路线

- **MVP**：5.1–5.6 六个 tool · HTTP+SSE 传输 · Settings 管理
- **P1**：Resources · stdio proxy npm 包 · `send_message` tool
- **P2**：OAuth2 动态注册 · 第三方应用授权流
