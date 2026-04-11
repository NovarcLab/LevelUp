# LevelUp · 技术架构与模块拆分

> 一台冷光屏幕背后是一台精确的机器。
> 文档目的：把 PRD / UI 落到可独立开发的子模块上，每个子模块对应一份 `docs/{module}/spec.md`。

---

## 0. 设计立场

LevelUp 是一个**对话先行 · 文件即记忆 · 关系即护城河 · 开放给本地 AI**的 Web 产品。
技术架构服从四条总则：

1. **文件系统是第一记忆，数据库只存关系** — 借鉴 OpenClaw / ClawOSS 的 workspace 模型：人格、长期记忆、对话摘要全部以 Markdown / JSON 落盘，SQLite 只承担结构化关系（目标树、消息索引）。这样记忆可被人读、可被 git 追溯、可被用户直接编辑。
2. **每个用户一个独立租户，物理隔离** — 一个用户 = 一个目录 = 一个 SQLite 文件 + 一组 md。跨租户查询在类型系统中不可能。导出即 tar，删除即 rm -rf。故障半径永远 = 单租户。
3. **每个子模块都能独立开发与替换** — 模块之间通过明确的 TypeScript 接口和事件总线通信，不共享内部状态。
4. **开放给本地 AI** — 通过 MCP server 让用户在自己的 Claude Code / Claude Desktop 里访问自己的目标树与进度。LevelUp 是"系统容器"，本地 LLM 是"即兴工具"。
5. **TypeScript 全栈，Docker 单容器即可跑通** — 没有 Kubernetes、没有微服务、没有云依赖。一台 VPS、一条 `docker compose up` 就是一次完整部署。

---

## 1. 技术栈

### 1.1 语言与运行时

| 层 | 选型 | 理由 |
|:---|:---|:---|
| 语言 | TypeScript 5.x（strict） | 全栈一致 · 类型即文档 |
| 运行时 | Node.js 22 LTS | 原生 fetch · stable test runner |
| 包管理 | pnpm + workspace | monorepo 共享类型 |

### 1.2 前端

| 层 | 选型 | 备注 |
|:---|:---|:---|
| 框架 | **Next.js 15**（App Router · RSC） | SSR · streaming · 文件路由 |
| UI | React 19 + TS | — |
| 样式 | **Tailwind CSS v4** + CSS variables | tokens 全部走 `:root` 变量，对应 `ui.md` §14 |
| 动效 | **Motion**（前 Framer Motion） + 自研 word-stream | UI §7 全部动效 |
| 状态 | **Zustand** + **TanStack Query** | 客户端轻状态 · 服务端缓存 |
| 流式 | **EventSource (SSE)** | 对话首字 < 1.5 s |
| 表单 | React Hook Form + Zod | — |
| 字体 | Inter · JetBrains Mono · 思源黑体（self-hosted） | FOUT 不 FOIT |
| 测试 | Vitest + Playwright | 组件 + E2E |

### 1.3 后端

| 层 | 选型 | 备注 |
|:---|:---|:---|
| 框架 | **Fastify 5** + TypeBox | 极简 · schema-first |
| ORM | **Drizzle ORM** | TS 原生 · SQL 零魔法 · 适配 SQLite |
| 数据库 | **SQLite (better-sqlite3)** + WAL | 单文件 · 零运维 |
| 全文检索 | SQLite FTS5 | 记忆检索后备 |
| 向量检索 | **sqlite-vec** | 嵌入式向量库，无需 pgvector |
| 缓存 | 进程内 LRU（无 Redis） | 单实例够用，留扩展位 |
| 任务调度 | **node-cron** + 文件锁 | 周复盘、记忆聚合 |
| 日志 | Pino（JSON · 流式） | — |
| 鉴权 | **Lucia** + Cookie session | 邮件 + Google OAuth |
| LLM SDK | `@anthropic-ai/sdk` + `openai` | 双供应商可切换 |

### 1.4 数据存储拓扑（DB-per-tenant 物理隔离）

```
data/                              ← 容器挂载 volume
├── system.db                      ← 系统库（仅 users / sessions / oauth / mcp_tokens）
├── tenants/                       ← 每用户一个独立租户目录
│   └── {tenantId}/
│       ├── tenant.db              ← 租户私有 SQLite：goals / messages / ...
│       ├── SOUL.md                ← 人格锚
│       ├── PROFILE.md             ← L1
│       ├── GOALS.md               ← L2 镜像
│       ├── MEMORY.md              ← 长期索引
│       ├── digests/
│       │   └── 2026-04-11.md      ← L3
│       ├── trends/
│       │   └── week-15.md         ← L4
│       ├── vectors/
│       │   └── memory.sqlite      ← sqlite-vec
│       ├── mcp-audit.jsonl        ← MCP 调用审计
│       ├── onboarding.json
│       └── locks/
├── backups/
│   └── {date}/                    ← 每日热备份（VACUUM INTO）
└── exports/
    └── {tenantId}-{ts}.tar.gz
```

**关键属性**

- **system.db 不存业务数据**，只回答"这个 email 是谁"和"这个 token 属于哪个 tenantId"
- **tenant.db 不存 user_id 列**——整个库只属于一个用户，user_id 隐含。跨租户查询在 schema 层就不可能
- **tenantId == userId**（预留为未来 team 版本的扩展点）
- 所有业务代码只接收 `TenantContext`，不接收 `userId` → 强制类型隔离
- 用户能直接 `cat tenants/{id}/MEMORY.md` 看到「AI 记得我什么」——透明即信任
- 导出 = `tar -czf` 一个目录；删除 = `rm -rf` 一个目录
- 故障半径永远 = 单租户：一个 tenant.db 损坏不会影响任何其他用户
- 10 万租户规模开始分片 `tenants/{shard}/{id}/`（按 id 前两位），代码逻辑不变

详细隔离机制 → `docs/tenancy/spec.md`

### 1.5 部署

| 组件 | 容器 | 端口 |
|:---|:---|:---|
| `web` | Next.js standalone | 3000 |
| `api` | Fastify | 4000 |
| `worker` | node-cron + 后台任务 | — |
| `caddy` | 反向代理 + 自动 HTTPS | 80 / 443 |

单一 `docker-compose.yml`，volume 挂载 `./data`，环境变量从 `.env` 读取。**没有 K8s、没有 Helm、没有云函数**。

---

## 2. 仓库布局

```
LevelUp/
├── apps/
│   ├── web/                       ← Next.js 前端
│   │   ├── app/                   ← App Router
│   │   ├── components/
│   │   │   ├── shell/             ← TopBar · Sidebar · Drawer
│   │   │   ├── chat/              ← 消息流 · 输入区
│   │   │   ├── cards/             ← 5 类对话卡片
│   │   │   ├── command-bar/       ← ⌘K
│   │   │   ├── onboarding/        ← Scene 1–5
│   │   │   ├── motion/            ← word-stream · halo · pulse
│   │   │   └── primitives/        ← Button · Input · Kbd ...
│   │   ├── styles/tokens.css      ← ui.md §14
│   │   └── lib/api.ts             ← 类型化 API client
│   └── api/                       ← Fastify 后端
│       └── src/
│           ├── modules/           ← 业务模块（见 §3）
│           ├── plugins/           ← Fastify 插件
│           ├── db/                ← Drizzle schema · migrations
│           └── server.ts
├── packages/
│   ├── shared/                    ← 全栈共享类型 · zod schema
│   ├── memory/                    ← 文件系统记忆引擎（独立包）
│   ├── context/                   ← 上下文装配引擎（独立包）
│   ├── persona/                   ← 温度系统（独立包）
│   └── llm/                       ← LLM 客户端抽象
├── docs/
│   ├── prd.md
│   ├── ui.md
│   ├── ui.pen
│   ├── tech.md                    ← 本文
│   ├── conversation/spec.md
│   ├── memory/spec.md
│   ├── persona/spec.md
│   ├── context/spec.md
│   ├── goal-tree/spec.md
│   ├── implementation-intention/spec.md
│   ├── card/spec.md
│   ├── shell/spec.md
│   ├── onboarding/spec.md
│   ├── command-bar/spec.md
│   ├── design-system/spec.md
│   ├── motion/spec.md
│   ├── auth/spec.md
│   ├── settings/spec.md
│   ├── scheduler/spec.md
│   ├── deployment/spec.md
│   └── plans/                     ← 临时实施计划
├── data/                          ← gitignored
├── docker-compose.yml
├── Dockerfile.web
├── Dockerfile.api
└── pnpm-workspace.yaml
```

---

## 3. 模块拆分

每个模块对应 `docs/{module}/spec.md`，互不依赖内部实现。下面是清单与边界。

### 3.1 模块全景

```
  ┌─────────────────────────┐     ┌─────────────────────────┐
  │      Frontend (web)     │     │  External MCP Clients   │
  │                         │     │  (local Claude Code,    │
  │  shell · chat · cards   │     │   Claude Desktop, ...)  │
  │  command-bar · onboard  │     └──────────┬──────────────┘
  │  motion · design-system │                │ bearer token
  └────────────┬────────────┘                │ HTTPS/SSE
               │ HTTPS · SSE                 │
               ▼                             ▼
  ┌──────────────────────────────────────────────────────┐
  │                   Backend (api)                      │
  │                                                      │
  │   auth · conversation · goal-tree · ii · card        │
  │   scheduler · settings · milestone · mcp-server      │
  └────────────┬─────────────────────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────────────────────┐
  │        tenancy · TenantRegistry (LRU + locks)        │
  │                                                      │
  │   preHandler: req → tenant = acquire(userId)         │
  │   all business calls receive TenantContext           │
  └─────┬──────────┬──────────┬───────┬──────┬───────────┘
        │          │          │       │      │
        ▼          ▼          ▼       ▼      ▼
   ┌────────┐ ┌─────────┐ ┌──────┐ ┌─────┐ ┌────────┐
   │ memory │ │ persona │ │ ctx  │ │ llm │ │ card   │
   └───┬────┘ └────┬────┘ └──┬───┘ └──┬──┘ └────────┘
       │           │          │        │
       ▼           ▼          ▼        ▼
  ┌─────────────────────────┐   Anthropic / OpenAI
  │ tenants/{id}/           │
  │   tenant.db             │   ← per-tenant SQLite
  │   SOUL.md  PROFILE.md   │
  │   GOALS.md MEMORY.md    │
  │   digests/ trends/      │
  │   vectors/memory.sqlite │
  └─────────────────────────┘

          system.db  (users · sessions · oauth · mcp_tokens)
```

### 3.2 模块清单

| # | 模块 | 类型 | 优先级 | 对应 PRD/UI |
|:--|:---|:---|:---|:---|
| M01 | **design-system** | 前端基建 | P0 | ui.md §2–6, §9, §14 |
| M02 | **motion** | 前端基建 | P0 | ui.md §5, §7 |
| M03 | **shell**（TopBar · Sidebar · Drawer） | 前端 | P0 | PRD §5 / ui.md §8.2–8.3 |
| M04 | **conversation** | 全栈 | P0 | PRD F1 / ui.md §8.2 |
| M05 | **card**（系统浮现卡片） | 全栈 | P0 | PRD F4 / ui.md §9.4 |
| M06 | **command-bar**（⌘K） | 前端 | P0 | ui.md §8.4 / §7.3 |
| M07 | **onboarding**（剧场） | 全栈 | P0 | PRD J1 / ui.md §8.1 |
| M08 | **goal-tree**（Goal/Milestone/Action） | 全栈 | P0 | PRD F2 |
| M09 | **implementation-intention** | 全栈 | P0 | PRD F3 |
| M10 | **memory**（文件系统记忆） | 后端核心 | P0 | PRD F6 |
| M11 | **persona**（温度系统） | 后端核心 | P0 | PRD §11.1 |
| M12 | **context**（上下文装配） | 后端核心 | P0 | PRD §11.4 / F6 |
| M13 | **llm**（供应商抽象 + 流式） | 后端 | P0 | PRD §13 |
| M14 | **auth**（Lucia + OAuth） | 后端 | P0 | PRD §10 |
| M15 | **settings**（含「AI 记得什么」面板） | 全栈 | P0 | PRD F6 / ui.md §11 |
| M16 | **scheduler**（cron · 周复盘 · check-in） | 后端 | P1 | PRD F9 |
| M17 | **roadmap-viz**（全局路线图） | 前端 | P1 | PRD F7 / ui.pen frame 13 |
| M18 | **support-tree**（子目标关系图） | 前端 | P1 | PRD F8 / ui.pen frame 14 |
| M19 | **milestone-celebration** | 全栈 | P1 | PRD F10 / ui.md §7.7 / §8.5 |
| M20 | **deployment**（Docker · Caddy · 备份） | 基建 | P0 | — |
| M21 | **tenancy**（DB-per-tenant · TenantContext） | 后端基建 | **P0** | 本文 §1.4 |
| M22 | **mcp-server**（开放给本地 Claude Code） | 后端 | P0 | tech.md §总则 |

下面对**每个模块**给出边界、依赖、数据契约。详细规格写到各自的 `spec.md`。

---

## 4. 核心模块详解

### M10 · memory（文件系统记忆系统） ★

> 这是产品的灵魂模块，借鉴 OpenClaw 的 workspace 思想。

#### 4.1 设计原则

1. **文件即真相**：记忆以人类可读的 Markdown 落盘，AI 读它、用户也能读它
2. **层级隔离**：L1–L4 各占独立文件，互不污染
3. **写入异步、读取同步**：对话流不被写入阻塞
4. **可被 git 追溯**：每个 workspace 是一个独立 git repo（可选），所有变更可回滚

#### 4.2 文件结构（每用户）

```
workspaces/user-{id}/
├── SOUL.md             ← 人格文件（由 persona 模块管理）
├── PROFILE.md          ← L1 核心档案：姓名/城市/职业/价值观
├── GOALS.md            ← L2 目标快照（从 SQLite 投影出的 Markdown 镜像）
├── MEMORY.md           ← 长期记忆索引：每条 ≤150 字符 + 指向 digests/
├── digests/
│   ├── 2026-04-11.md   ← L3 对话摘要（一对话一段 · 一天一文件）
│   └── ...
├── trends/
│   ├── week-15.md      ← L4 周聚合（执行模式 · 情绪曲线 · 反复障碍）
│   └── ...
└── vectors/
    └── memory.sqlite   ← sqlite-vec：digest 嵌入向量
```

#### 4.3 接口（`packages/memory`）

```ts
interface MemoryStore {
  // L1
  readProfile(userId: string): Promise<Profile>;
  patchProfile(userId: string, patch: Partial<Profile>): Promise<void>;

  // L2 · 由 goal-tree 模块写入，memory 只读
  syncGoalsSnapshot(userId: string, goals: GoalTree): Promise<void>;

  // L3
  appendDigest(userId: string, digest: SessionDigest): Promise<void>;
  readRecentDigests(userId: string, n: number): Promise<SessionDigest[]>;
  searchDigests(userId: string, query: string, k: number): Promise<SessionDigest[]>;

  // L4
  aggregateWeek(userId: string, isoWeek: string): Promise<TrendReport>;
  readLatestTrend(userId: string): Promise<TrendReport | null>;

  // 软删除（用户「忘掉这件事」）
  forget(userId: string, segmentId: string): Promise<void>;
}
```

#### 4.4 写入时机

| 触发 | 动作 | 同/异步 |
|:---|:---|:---|
| 对话结束 / 30 min 无交互 | LLM 生成 SessionDigest → `digests/{date}.md` | 异步（队列） |
| 用户改 Profile | 写 PROFILE.md + 重建索引 | 同步 |
| 目标变更 | goal-tree 调用 `syncGoalsSnapshot` | 同步 |
| 周日 23:00 | scheduler 触发 `aggregateWeek` | 异步 cron |
| 用户「忘掉 X」 | 软删除（注释行 + 重建向量） | 同步 |

#### 4.5 与 SQLite 的分工

| 关注点 | 存储 |
|:---|:---|
| 关系结构（Goal → Milestone → Action） | SQLite |
| 消息原文 + 时间戳 + 索引 | SQLite |
| 用户身份 / Session | SQLite |
| 人格、长期记忆、摘要、趋势 | 文件系统 |
| 向量索引 | 文件系统（sqlite-vec，per user） |

**原则**：能用 SQL 查的进 SQLite；要被 LLM 读、要被人读的进文件。

详细规格 → `docs/memory/spec.md`

---

### M11 · persona（温度系统） ★

> 借鉴 OpenClaw 的 SOUL.md / IDENTITY.md：人格不是 prompt 字符串，而是一份**可被读、可被改、可被审计**的文件。

#### 5.1 什么是「温度系统」

不是 LLM 采样的 `temperature` 参数。是产品意义上的**人格温度**——AI 在每次回复中表达的关怀强度、直白程度、停顿节奏。它由四份文件 + 一个调节器组成。

#### 5.2 文件结构

```
workspaces/user-{id}/
└── SOUL.md
```

```
packages/persona/templates/
├── soul.base.md          ← 全局人格基线（产品默认）
├── boundaries.md         ← 边界条款（不提供医疗/法律建议等）
└── anti-cliche.md        ← 套话黑名单（「当然可以」「希望对你有帮助」…）
```

`SOUL.md` 在用户首次建档后由 `soul.base.md` 复制生成，并随对话演化（AI 学会用户接受的语气强度）。

#### 5.3 三个调节维度

| 维度 | 范围 | 含义 | 调节信号 |
|:---|:---|:---|:---|
| **Warmth**（温度） | 0–100 | 关怀外显程度 | 用户使用情绪词 / 长期沉默 → 升 |
| **Directness**（直白度） | 0–100 | 指出逃避的力度 | 用户连续漏做 / 自我合理化 → 升 |
| **Pacing**（节奏） | 0–100 | 停顿与回复长度 | 情绪触发 → 降（更多停顿、更短回复） |

三个维度持久化在 `SOUL.md` 的 frontmatter，每次对话开始前由 persona 模块读取并注入 system prompt。

#### 5.4 接口

```ts
interface PersonaEngine {
  loadSoul(userId: string): Promise<Soul>;
  buildSystemPrompt(soul: Soul, ctx: ConversationContext): string;
  calibrate(userId: string, signal: PersonaSignal): Promise<void>;
  validateResponse(text: string): { ok: boolean; violations: string[] };
}
```

`validateResponse` 在 LLM 输出后过一道反套话过滤器：命中黑名单 → 重新生成（最多 1 次重试）。这是 PRD §13「套话拒绝率 >95%」的兜底。

#### 5.5 与 OpenClaw 的对照

| OpenClaw | LevelUp |
|:---|:---|
| `SOUL.md` 锚定 agent 身份 | `SOUL.md` 锚定 AI 人格 |
| `IDENTITY.md` 不变 | `boundaries.md` 不变 |
| Heartbeat prompt 注入风格 | `buildSystemPrompt` 注入风格 |

详细规格 → `docs/persona/spec.md`

---

### M12 · context（上下文装配系统） ★

> 借鉴 OpenClaw 的 context-manager：上下文不是「把所有东西塞进去」，是**预算约束下的优先级装配**。

#### 6.1 责任

每次用户消息到达 → 装配一个完整的 LLM 调用上下文：

```
[ system prompt (persona) ]
[ profile L1 ]
[ goal snapshot L2 ]
[ relevant digests L3 (检索) ]
[ latest trend L4 ]
[ conversation tail (最近 N 条) ]
[ user message ]
```

**预算 ~2000 tokens**（PRD §F6），超出按优先级截断。

#### 6.2 装配流水线

```
UserMessage
   │
   ▼
1. intent classify (轻量 LLM 或规则)        ← 决定模板
   │
   ▼
2. budget plan (按 intent 分配 token 预算)
   │
   ▼
3. fetch in parallel:
     · persona.buildSystemPrompt
     · memory.readProfile
     · memory.syncGoalsSnapshot (从 goal-tree)
     · memory.searchDigests (向量检索)
     · memory.readLatestTrend
     · conversation.tail(10)
   │
   ▼
4. assemble + truncate by priority
   │
   ▼
5. emit ContextPacket → llm
```

#### 6.3 接口

```ts
interface ContextEngine {
  build(input: {
    userId: string;
    conversationId: string;
    userMessage: string;
    intent?: Intent;
  }): Promise<ContextPacket>;
}

interface ContextPacket {
  systemPrompt: string;
  messages: ChatMessage[];
  meta: {
    tokenEstimate: number;
    droppedSegments: string[];
    intent: Intent;
  };
}
```

#### 6.4 截断策略（必保 → 可弃）

```
1. systemPrompt (persona)         必保
2. profile L1                     必保
3. user message                   必保
4. last 3 messages                必保
5. active goal snapshot           ← 第一档可截
6. last week trend                ← 第二档可截
7. older 7 messages               ← 第三档可截
8. retrieved digests              ← 第四档可截
```

#### 6.5 与 OpenClaw 的对照

| OpenClaw context-manager | LevelUp context |
|:---|:---|
| 70% 阈值刷写 state 到文件 | 对话结束写 digest 到文件 |
| compaction 保留 `postCompactionSections` | 装配保留 `mustKeep` segments |
| `keepRecentTokens` 保最近对话 | `tail(10)` 必保 |
| `memoryFlush.prompt` 主动落盘 | `appendDigest` 异步落盘 |

详细规格 → `docs/context/spec.md`

---

### M04 · conversation

#### 责任
- 消息持久化（SQLite）
- SSE 流式响应通道
- 意图路由（PRD §11.2）
- 触发 card-decision、context、persona、llm 串联

#### 数据模型（SQLite）

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  context_goal_id TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  embedded_cards TEXT,           -- JSON
  edited_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);
CREATE VIRTUAL TABLE messages_fts USING fts5(content, content_rowid='id');
```

#### 端点

| Method | Path | 说明 |
|:---|:---|:---|
| `POST` | `/api/conversations/:id/messages` | SSE：返回 `token` · `card` · `done` 事件 |
| `GET` | `/api/conversations/:id` | 历史消息分页 |
| `PATCH` | `/api/messages/:id` | 24h 内编辑 |

详细规格 → `docs/conversation/spec.md`

---

### M08 · goal-tree

四层结构（Goal · Milestone · Action · ImplementationIntention），SQLite 存关系，每次变更写一份 `GOALS.md` 镜像供 memory 读取。

#### Schema 摘要

```sql
CREATE TABLE goals (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  title TEXT NOT NULL, why_statement TEXT,
  target_completion_date INTEGER,
  status TEXT CHECK(status IN ('active','paused','completed','archived')),
  created_at INTEGER, updated_at INTEGER
);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY, goal_id TEXT NOT NULL,
  title TEXT, target_week_index INTEGER,
  display_order INTEGER, status TEXT, completed_at INTEGER
);

CREATE TABLE actions (
  id TEXT PRIMARY KEY, milestone_id TEXT NOT NULL,
  title TEXT, week_of TEXT,
  status TEXT CHECK(status IN ('pending','in_progress','done','skipped')),
  completed_at INTEGER
);

CREATE TABLE implementation_intentions (
  id TEXT PRIMARY KEY, action_id TEXT NOT NULL,
  trigger TEXT, behavior TEXT, termination TEXT, fallback TEXT,
  status TEXT, success_count INTEGER DEFAULT 0, fail_count INTEGER DEFAULT 0
);
```

任何写操作触发 `memory.syncGoalsSnapshot` → 同步 GOALS.md。

详细规格 → `docs/goal-tree/spec.md`

---

### M05 · card

5 类卡片（C1–C5）的**决策引擎** + 渲染契约。

#### 决策

```ts
interface CardDecisionEngine {
  decide(input: {
    userMessage: string;
    intent: Intent;
    history: Message[];
    activeGoals: GoalSnapshot[];
  }): Promise<CardPayload | null>;
}
```

按 PRD §11.3 的优先级表 + §F4 的密度规则（一次对话最多 2 张 · 相邻间隔 ≥3 条消息 · 同类 1 小时不重复）。

#### 渲染

前端 `components/cards/{Progress,Locate,Status,Summary,Encourage}.tsx`，卡片不独立请求数据，全部走消息内嵌 JSON。Card Push 动效见 ui.md §7.4。

详细规格 → `docs/card/spec.md`

---

### M13 · llm

#### 责任
- 抽象 Anthropic / OpenAI 双供应商
- 流式 token 转 SSE
- 失败重试（指数回退 · 最多 2 次）
- 成本 / 延迟 metrics

#### 接口

```ts
interface LLMClient {
  stream(input: {
    systemPrompt: string;
    messages: ChatMessage[];
    maxTokens?: number;
  }): AsyncIterable<LLMEvent>;
}

type LLMEvent =
  | { type: 'token'; text: string }
  | { type: 'finish'; usage: TokenUsage }
  | { type: 'error'; error: Error };
}
```

详细规格 → `docs/llm/spec.md`

---

## 5. 前端模块详解

### M01 · design-system
- Token 文件 `styles/tokens.css`，全量对应 ui.md §14
- Primitive 组件：Button · LineInput · BoxedInput · Kbd · Dot · ProgressTrack · Sheet · Popover
- 暗模式默认 · 22:00 切换提示
- Storybook 不做（避免双仓库），用 `/dev` 路由作为组件实验场

详细规格 → `docs/design-system/spec.md`

### M02 · motion
- `WordStream` 组件（按词流入 · 见 ui.md §7.2）
- `AmbientHalo` 组件（呼吸背景 · §7.1）
- `CardPush` · `SidebarSlide` · `CommandBarRise` · `MilestoneFlash` · `ErrorPulse`
- 共享时长 / 缓动常量

详细规格 → `docs/motion/spec.md`

### M03 · shell
- TopBar（48 px · 品牌 · 上下文 · ⌘K · ⚙）
- Sidebar 双态（56 ↔ 280 · ⌘B）
- Drawer 系统（目标详情 · 设置）
- 全局快捷键 hub

详细规格 → `docs/shell/spec.md`

### M06 · command-bar
- ⌘K 唤起（§7.3 动效）
- 目标分组 + 命令分组
- 模糊匹配（cmdk 库）
- 错过 token 时被替换为登录输入

详细规格 → `docs/command-bar/spec.md`

### M07 · onboarding
- Scene 1–5（ui.md §8.1，对应 ui.pen frame 1–4）
- 对应后端：建档向导（PRD §F2）
- 状态机驱动 · 不可跳过 · 无进度条

详细规格 → `docs/onboarding/spec.md`

---

## 6. 横切模块

### M14 · auth
- Lucia + Cookie session（HttpOnly · Secure · SameSite=Lax）
- Provider：邮件 magic link · Google OAuth
- Session 存 SQLite
- 创建用户时 → 初始化 workspace 目录 + 写 SOUL.md / PROFILE.md

详细规格 → `docs/auth/spec.md`

### M15 · settings
- 资料编辑（写 PROFILE.md）
- 「AI 记得什么」面板：列出 L1 + L3，可逐条删除
- 数据导出（`exports/{userId}-{ts}.zip`）
- 一键删除全部数据（删 workspace + SQLite 行）
- 主题切换 · 声音开关

详细规格 → `docs/settings/spec.md`

### M16 · scheduler
- node-cron 单进程，文件锁防并发
- Job：周聚合（周日 23:00）· 沉默检测（每小时）· 周复盘提醒（周日 09:00）· 备份（每日 03:00）
- Job 状态写 `data/scheduler-state.json`，重启可恢复

详细规格 → `docs/scheduler/spec.md`

### M19 · milestone-celebration
- 后端：完成事件广播
- 前端：§7.7 冷光一闪 + 1.5s 静止
- 庆祝后 AI 用户故事化的一句话回顾

详细规格 → `docs/milestone-celebration/spec.md`

### M20 · deployment
- `Dockerfile.web`（Next.js standalone · multi-stage）
- `Dockerfile.api`（Fastify · 含 better-sqlite3 native build）
- `docker-compose.yml`（web · api · worker · caddy）
- Caddyfile 自动 HTTPS
- 备份策略：`data/` 每日打包 → `backups/`，保留 14 天
- 健康检查：`/healthz` · 启动顺序：api → web → worker

详细规格 → `docs/deployment/spec.md`

---

## 7. 关键调用链

### 7.1 用户发送一条消息（最热路径）

```
[Web]
  ChatInput.send(text)
    → POST /api/conversations/{id}/messages (SSE)

[api · preHandler]
  tenant = await tenantRegistry.acquire(req.user.id)
  → 后续 handler 只接 ctx = tenant, 不再看到 userId

[api · conversation]
  1. persist user message → ctx.db (tenant.db)
  2. packet = await context.build(ctx, { conversationId, text })
       ├─ persona.loadSoul(ctx)                  ← SOUL.md in tenant dir
       ├─ memory.readProfile(ctx)                ← PROFILE.md in tenant dir
       ├─ memory.searchDigests(ctx, text, 3)     ← ctx.vectors
       ├─ memory.readLatestTrend(ctx)
       ├─ goalTree.activeSnapshot(ctx)           ← ctx.db
       └─ conversation.tail(ctx, 10)
  3. for await (event of llm.stream(packet)) → SSE 'token'
  4. persona.validateResponse → 命中套话重试 1 次
  5. cardDecision.decide(ctx, ...) → 可能 SSE 'card'
  6. persist assistant message → ctx.db
  7. SSE 'done'
  8. 异步 (队列):
       · digestWriter.schedule(tenantId, conversationId)
       · personaCalibrator.observe(ctx, text, response)

[api · onResponse]
  tenantRegistry.release(ctx)
```

### 7.2 对话结束 → 写记忆

```
[worker · digestWriter loop 每 60s]
  allTenants = SELECT id FROM system.db users WHERE deleted_at IS NULL
  for each tenantId:
    ctx = await tenantRegistry.acquire(tenantId)
    try:
      pending = SELECT id FROM ctx.db conversations
                WHERE last_msg_at < now-30min AND digest_written = 0
      for each:
        1. messages = conversation.full(ctx, id)
        2. digest = await llm.summarize(messages)
        3. memory.appendDigest(ctx, digest)           // digests/{date}.md
        4. ctx.vectors.upsert(digest.id, embedding)
        5. UPDATE ctx.db conversations SET digest_written=1
    finally:
      tenantRegistry.release(ctx)
```

### 7.3 周日聚合 → 长期趋势

```
[scheduler] cron '0 23 * * 0'
  for each tenantId in system.db users:
    ctx = await tenantRegistry.acquire(tenantId)
    try:
      digests = memory.readWeek(ctx)
      trend = await llm.aggregate(digests)
      memory.writeTrend(ctx, isoWeek, trend)          // trends/week-15.md
    finally:
      tenantRegistry.release(ctx)
```

### 7.4 本地 Claude Code 调用 MCP

```
[User's Claude Code]
  tool_call: list_active_goals

[api · POST /mcp]
  1. auth: token = req.headers.authorization
           row = system.db mcp_tokens WHERE hash = sha256(token)
           if !row || revoked → 401
  2. scope check: row.scopes ⊇ required('goals:read')
  3. tenant = await tenantRegistry.acquire(row.userId)
  4. result = goalTree.activeSnapshot(tenant)
  5. audit: append tenants/{id}/mcp-audit.jsonl
  6. tenantRegistry.release(tenant)
  7. return JSON-RPC response
```

**关键**：MCP 请求进入 TenantContext 的路径和 web session 请求**完全一致**。业务代码不区分"来自 web"还是"来自 MCP"，只看 `ctx`。

---

## 8. 非功能落地

| PRD 要求 | 落地 |
|:---|:---|
| 对话首字 < 1.5 s | SSE · context.build 并行 fetch · LLM stream first token |
| 页面首屏 < 2 s | Next.js RSC + Edge cache 首屏 · 字体 self-hosted |
| 端对端加密 | workspace 文件用 AES-GCM 加密落盘，密钥派生自用户 password+salt（可选 P1） |
| 可导出 / 删除 | settings 模块 · `exports/` 落盘 |
| 对话零丢失 | SSE 出错时客户端缓存输入 · 服务端事务化写消息 |
| 套话拒绝率 >95% | persona.validateResponse + 单测黑名单覆盖 |
| 10 万并发 | SQLite WAL + 单实例 Fastify 实测撑住；水平扩展时改 Postgres + S3 即可（接口不变） |

---

## 9. 开发与发布流程

### 9.1 本地开发

```
pnpm i
pnpm dev               # web + api + worker 并行
pnpm db:migrate        # drizzle migrations
pnpm test              # vitest
pnpm e2e               # playwright
```

`data/levelup.db` 由 migrations 创建；`data/workspaces/` 由 auth 模块按需创建。

### 9.2 CI

- `pnpm lint && pnpm typecheck && pnpm test` 必须绿
- E2E 在 PR merge 前跑一次
- Docker build 在 main 分支 push 后跑

### 9.3 发布

`docker compose pull && docker compose up -d`，volume 不变即数据不动。

---

## 10. Phase 路线对照

| Phase | 交付模块 |
|:---|:---|
| **MVP (Week 1–8)** | M01–M15, M20, **M21 (tenancy)**, **M22 (mcp-server 基础)** |
| **Phase 2 (Week 9–16)** | M16, M17, M18, M19 + 周复盘强化 + MCP resources/stdio proxy |
| **Phase 3 (Week 17–24)** | iOS App（共用 api · 新建 `apps/ios`） · 模板市场 · 季年报告 · MCP OAuth2 动态注册 |

---

## 11. 决策记录

| # | 决策 | 取舍 |
|:--|:---|:---|
| D1 | 文件系统作为记忆，而非数据库 | + 透明可读 + 易迁移 + 借鉴 OpenClaw 成熟模式 / − 检索成本略高（用 sqlite-vec 抵消） |
| D2 | SQLite 而非 Postgres | + 单文件 + 零运维 + 单机 10w 并发够用 / − 水平扩展需迁移（接口已抽象，迁移可控） |
| D3 | Next.js + Fastify 双进程而非全 Next.js | + 后端可独立部署 + Fastify schema 更稳 / − 多一个进程（Docker Compose 已处理） |
| D4 | Lucia 而非 NextAuth | + 更轻 + Cookie session 透明 / − 生态略小 |
| D5 | Drizzle 而非 Prisma | + TS 原生 + 启动快 + better-sqlite3 友好 / − migration 工具更朴素 |
| D6 | 文件锁 + node-cron 而非 BullMQ | + 无 Redis 依赖 + 单实例够 / − 多实例需换 |
| D7 | persona / context / memory 拆为 packages | + 强模块边界 + 可单测 + 未来可抽出独立服务 / − monorepo 配置成本 |
| D8 | DB-per-tenant 物理隔离而非单库 RLS | + 故障半径 = 1 + 导出/删除即 tar/rm + 跨租户查询在类型层被禁 / − 跨租户分析需 ETL |
| D9 | 开放 MCP server 而非自建插件协议 | + 零学习成本 + 复用 Claude Code 生态 + Anthropic 官方标准 / − 协议仍在演进 |

---

## 12. 下一步

1. 创建 `docs/{module}/spec.md` 占位（20 个）
2. 优先写：`memory/spec.md` · `persona/spec.md` · `context/spec.md` · `conversation/spec.md` · `design-system/spec.md`
3. 每份 spec 包含：目标 · 接口 · 数据契约 · 文件结构 · 测试要点 · 风险
4. spec 写完再开 `apps/web` 与 `apps/api` 脚手架
