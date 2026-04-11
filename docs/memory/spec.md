# Memory · 文件系统记忆系统

> 产品的灵魂。记忆不是向量库里的一堆浮点数，是用户能 `cat` 出来的 Markdown。

---

## 1. 目标

- 让 AI 跨会话保留对用户的了解（PRD H2 留存的核心杠杆）
- 让用户看见、编辑、删除 AI 记住的任何一条
- 让记忆可被 git 追溯、可被 tar 备份、可被整段迁移

**非目标**
- 记住每一个字（我们只记结构化摘要，不存原始消息正文到记忆层 —— 原文在 SQLite 的 messages 表）
- 做"无限上下文"（预算在 context 模块里管）

---

## 2. 四层记忆

| 层 | 内容 | 形态 | 更新节奏 |
|:---|:---|:---|:---|
| **L1 · Profile** | 姓名 · 城市 · 职业 · 价值观 · 关键关系 | `PROFILE.md` frontmatter + 正文 | 建档写入 · 对话提取补丁 |
| **L2 · Goals** | 当前目标树快照（投影自 SQLite） | `GOALS.md` | 目标每次变更同步 |
| **L3 · Digests** | 每次对话的 3–5 条要点 + 情绪标签 + 未决问题 | `digests/{date}.md` 按天分文件 | 对话结束 30 秒后异步写 |
| **L4 · Trends** | 执行模式 · 情绪曲线 · 反复障碍 | `trends/week-{iso}.md` | 周日 23:00 cron 聚合 |

---

## 3. 文件结构

每个租户（= 每个用户）一个独立目录。路径由 `tenancy` 模块的 `TenantContext.tenantDir` 给出，memory 模块**不自己拼路径**。

```
data/tenants/{tenantId}/           ← 由 tenancy 模块管理
├── SOUL.md                        ← persona 管理，memory 只读不写
├── PROFILE.md                     ← L1
├── GOALS.md                       ← L2（镜像）
├── MEMORY.md                      ← 长期记忆索引
├── digests/
│   ├── 2026-04-11.md              ← L3
│   └── ...
├── trends/
│   ├── week-2026-W15.md           ← L4
│   └── ...
└── vectors/
    └── memory.sqlite              ← sqlite-vec, per-tenant
```

### 3.1 PROFILE.md 样例

```markdown
---
name: 晓明
city: 上海
role: 产品经理
values:
  - 自主
  - 深度
relationships:
  - type: partner
    name: 小米
    since: 2023
updated_at: 2026-04-11T10:32:00Z
---

## About

晓明今年 28，在一家 A 轮做 PM。他想在年底前把副业 MVP 上线。
周日晚上容易焦虑，通常那时打开 LevelUp 看看自己推进了什么。
```

### 3.2 digests/2026-04-11.md 样例

```markdown
# 2026-04-11

## Session 01 · 20:14–20:42

- **关于**：副业 MVP 文档
- **进展**：写完了「问题定义」和「目标用户」两节
- **情绪**：中等 · 偶尔自我怀疑
- **未决**：不确定要不要把「竞品分析」放进 MVP
- **AI 承诺**：周四晚上会主动问进度

<!-- segment-id: d-01HGF... -->
<!-- embedding: stored in vectors/memory.sqlite -->
```

每条 digest 有一个唯一 `segment-id`，可被用户「忘掉这件事」命令软删除（HTML 注释标记为 `deleted`，向量表同步删除，但文件保留以供 git 追溯）。

### 3.3 MEMORY.md 样例（长期索引）

```markdown
# 晓明 · 长期记忆

## 他是谁
- [核心档案](PROFILE.md) — 28 · PM · 上海
- 周日晚上焦虑型回访者

## 正在推进
- [副业 MVP](GOALS.md#side-project-mvp) — 58% · 本周焦点：完成文档

## 执行模式（从 trends 聚合）
- 最有效的触发：晚上 9 点书桌前
- 最常漏做：周三（例会日疲惫）
- 情绪低谷：月末

## 约定
- 不说"太棒了"、不说"加油"
- 周四晚上主动问文档进度
```

每一行指向一个具体文件。**MEMORY.md 是索引，不是仓库**——保持 ≤200 行，超过触发重聚合。

---

## 4. 接口（`packages/memory`）

**所有接口只接 `TenantContext`，不接 `userId`**。拿到 ctx 即进入该租户沙盒，跨租户查询在类型上不可能。

```ts
import type { TenantContext } from '@levelup/tenancy';

export interface MemoryStore {
  // 初始化由 tenancy.provision 调用（不在这里 mkdir tenant 目录）
  initProfile(ctx: TenantContext): Promise<void>;

  // L1
  readProfile(ctx: TenantContext): Promise<Profile>;
  patchProfile(ctx: TenantContext, patch: Partial<Profile>): Promise<void>;

  // L2（goal-tree 调用）
  syncGoalsSnapshot(ctx: TenantContext, tree: GoalTree): Promise<void>;
  readGoalsSnapshot(ctx: TenantContext): Promise<string>;

  // L3
  appendDigest(ctx: TenantContext, d: SessionDigest): Promise<void>;
  readRecentDigests(ctx: TenantContext, n: number): Promise<SessionDigest[]>;
  searchDigests(ctx: TenantContext, query: string, k: number): Promise<SessionDigest[]>;
  forgetDigest(ctx: TenantContext, segmentId: string): Promise<void>;

  // L4
  writeTrend(ctx: TenantContext, isoWeek: string, trend: TrendReport): Promise<void>;
  readLatestTrend(ctx: TenantContext): Promise<TrendReport | null>;

  // 索引
  rebuildMemoryIndex(ctx: TenantContext): Promise<void>;

  // 管理
  exportAll(ctx: TenantContext): Promise<Buffer>;           // tar.gz 的是 tenant 整个目录
}
// 注意：deleteAll 不在这里 —— 物理删除是 tenancy.deprovision 的职责
```

### 4.1 类型

```ts
interface Profile {
  name: string;
  city?: string;
  role?: string;
  values: string[];
  relationships: Relationship[];
  updatedAt: string;
  about: string;   // 正文 Markdown
}

interface SessionDigest {
  segmentId: string;
  conversationId: string;
  startedAt: string;
  endedAt: string;
  topic: string;
  progress: string;
  mood: 'low' | 'mid' | 'high' | 'mixed';
  openQuestions: string[];
  aiPromises: string[];
  importance: number;     // 0–100
  deleted?: boolean;
}

interface TrendReport {
  isoWeek: string;
  executionPattern: string;
  mostEffectiveTrigger: string;
  mostMissedDay: string;
  emotionalArc: string;
  recurringBlockers: string[];
}
```

---

## 5. 写入流水线

```
对话结束 (last_msg_at < now-30min)
   │
   ▼
digestWriter.pollLoop (每 60s)
   │
   ▼
1. 取 messages (conversation.full)
2. llm.summarize(messages, schema=SessionDigestSchema)    ← 小模型，结构化输出
3. memory.appendDigest(userId, digest)
     ├─ 追加到 digests/{date}.md
     └─ 写 vectors/memory.sqlite (embedding)
4. UPDATE conversations SET digest_written = 1
```

**失败策略**：失败 → 记录到 `data/digest-failures.jsonl`，下次启动重试，不丢。

---

## 6. 检索策略（给 context 模块用）

### 6.1 默认检索

```
searchDigests(userId, query, k=3)
   │
   ▼
1. embedding(query)              ← 小模型或本地 BGE
2. sqlite-vec KNN top 10
3. 按 importance × recency 重排
4. 过滤 deleted=true
5. 返回 top k
```

### 6.2 重要度衰减

每次被检索命中：`importance = min(100, importance + 2)`
每 30 天未被命中：`importance = importance × 0.9`

衰减任务由 scheduler 每周执行一次，更新 digest 文件 frontmatter。

---

## 7. 用户可控性

| 用户动作 | 实现 |
|:---|:---|
| 在设置页查看 L1 | 读 PROFILE.md 渲染表单 |
| 编辑 L1 字段 | patchProfile → 原子写 |
| 查看 L3 某天 | 渲染 digests/{date}.md |
| 删除某条 L3 | forgetDigest：标记 deleted + 向量删除 |
| 对话中说「忘掉我换工作的事」 | conversation → memory.searchDigests → forgetDigest |
| 查看 L4 | 渲染 trends/week-{iso}.md |
| 导出 | exportAll → tar.gz |
| 删除全部 | deleteAll → 递归删 workspace + 清 SQLite 行 |

---

## 8. 并发与原子性

- **文件写入**：先写 `.tmp` → `fs.rename`（原子）
- **同文件并发**：每个 userId 一把内存锁（async-mutex），worker 与 api 共享
- **多进程**：用文件锁（`proper-lockfile`）兜底，worker 和 api 拿锁后再写
- **向量库**：better-sqlite3 WAL 天然多读单写

---

## 9. 性能指标

| 操作 | 目标 |
|:---|:---|
| `readProfile` | < 5 ms |
| `appendDigest` | < 50 ms |
| `searchDigests(k=3)` | < 30 ms（1 万条以内） |
| `syncGoalsSnapshot` | < 20 ms |

benchmark 用 vitest + tinybench，CI 保持回归基线。

---

## 10. 测试要点

- **单测**：每个接口 happy path + 边界（空 workspace、损坏文件、并发写）
- **属性测试**：fast-check · 生成随机 Profile patch 序列，最终状态等价
- **E2E**：
  1. 注册 → initWorkspace 产出完整目录
  2. 3 次对话 → 3 个 digest 文件
  3. 用户说「忘掉第 2 次对话」→ 对应 segment 被标记
  4. 周日触发 → trends 文件出现
- **崩溃恢复**：写入一半杀进程 → 启动后读取不出错

---

## 11. 风险

| 风险 | 缓解 |
|:---|:---|
| 用户手改 PROFILE.md 格式破损 | 读取时 zod schema 校验 · 失败回滚到上次 valid 版本（`PROFILE.md.bak`） |
| workspace 目录爆炸（digests 无限增长） | 90 天前的 digest 归档到 `archive/{year}.tar`，检索不受影响 |
| sqlite-vec 索引漂移 | 每周 scheduler 验证 digest 数 == 向量数，不一致则重建 |
| 用户设备时区不一致导致文件名冲突 | 文件名使用 UTC 日期，frontmatter 存 user timezone |
| 多实例扩展 | 当前单实例够用，迁移方案：workspaces 放共享文件系统（NFS / S3FS），向量库改 Qdrant |

---

## 12. 依赖的其他模块

| 依赖 | 用于 |
|:---|:---|
| `llm` | summarize / aggregate |
| `persona` | 只读 SOUL.md 位置常量 |
| `goal-tree` | 接收 `syncGoalsSnapshot` 调用 |
| `scheduler` | 触发周聚合 · 重要度衰减 · 归档 |
