# Context · 上下文装配系统

> 上下文不是"把能塞的都塞进去"，是**预算约束下的优先级装配**。
> 借鉴 OpenClaw 的 context-manager：必保段、可弃段、截断策略全部显式。

---

## 1. 目标

- 每次 LLM 调用前，把 persona / memory / goal / 历史消息装配成一个 token 预算内的 ContextPacket
- 预算 ~2000 tokens（PRD §F6）
- 超预算时按明确优先级截断，不让 LLM 自己猜

**非目标**
- 不做"无限上下文"
- 不做 RAG 的重排算法研究（用 memory 返回的 top-k 即可）
- 不直接调用 LLM（这是 llm 模块的职责）

---

## 2. 装配组成

每个 ContextPacket 由以下段落组成，按**必保级别**排序：

| 级别 | 段落 | 来源 | 预算 | 可弃？ |
|:---|:---|:---|:---|:---|
| 0 | system prompt | persona.buildSystemPrompt | ~800 | 否 |
| 0 | user message | 输入 | 变 | 否 |
| 0 | last 3 messages | conversation | ~300 | 否 |
| 1 | profile L1 | memory.readProfile | ~200 | 否 |
| 2 | active goal snapshot | goal-tree + memory.readGoalsSnapshot | ~300 | 可弃 |
| 3 | latest trend L4 | memory.readLatestTrend | ~150 | 可弃 |
| 4 | older 7 messages | conversation | ~500 | 可弃 |
| 5 | retrieved digests L3 | memory.searchDigests | ~300 | 可弃 |

级别 0–1 必保，总约 1300 tokens，余 ~700 给可弃段按级别装填。

---

## 3. 接口

```ts
export interface ContextEngine {
  build(input: BuildInput): Promise<ContextPacket>;
}

interface BuildInput {
  userId: string;
  conversationId: string;
  userMessage: string;
  intent?: Intent;      // 可选 · 未提供则内部分类
  budget?: number;      // 默认 2000
}

interface ContextPacket {
  systemPrompt: string;
  messages: ChatMessage[];
  meta: {
    tokenEstimate: number;
    budget: number;
    intent: Intent;
    includedSegments: SegmentId[];
    droppedSegments: SegmentId[];
    buildDurationMs: number;
  };
}

type SegmentId =
  | 'system' | 'user_msg' | 'recent_3'
  | 'profile' | 'goals' | 'trend'
  | 'history_7' | 'digests';
```

---

## 4. 装配流水线

```
BuildInput
   │
   ▼
┌──────────────────────────┐
│ 1. intent classify       │  ← 若未提供
│    (轻量 LLM 或规则)     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 2. parallel fetch        │  ← 全部并行，减少延迟
│    · persona.loadSoul    │
│    · memory.readProfile  │
│    · memory.readGoals    │
│    · memory.searchDigests│
│    · memory.readTrend    │
│    · conversation.tail(10)│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 3. buildSystemPrompt     │
│    (persona + intent)    │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 4. estimate tokens       │  ← tiktoken / 自研近似
│    per segment           │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 5. pack                  │
│    while total > budget: │
│      drop(lowest level)  │
└──────────┬───────────────┘
           │
           ▼
     ContextPacket
```

**步骤 2 全部并行**——这是 PRD §13 "首字 <1.5s" 的关键。即便 memory 检索 30ms、persona 5ms，串行 ≥80ms，并行只要 30ms。

---

## 5. 意图分类（Intent Classifier）

```ts
type Intent =
  | 'progress_report'      // "写了" / "完成"
  | 'emotion'              // "累" / "迷茫"
  | 'goal_query'           // "我该" / "下一步"
  | 'new_goal'             // "想开始"
  | 'retro_request'        // "复盘"
  | 'goal_adjust'          // "想改"
  | 'small_talk';          // 其他
```

**轻量规则 first**（关键词匹配 + 正则）→ 不确定时走 LLM 分类（小模型，50 tokens 输出）。

规则命中阈值 ≥ 0.7 直接返回；否则调 LLM。实测 80% 的消息走规则即可。

规则文件：`packages/context/intent-rules.ts`

---

## 6. 按 intent 调整装配策略

| intent | 调整 |
|:---|:---|
| `progress_report` | 必带 active goal snapshot（级别 2 升级到必保） |
| `emotion` | 必带 latest trend（提供情绪背景）· pacing 信号透传给 persona |
| `goal_query` | 必带 active goal snapshot + older history 7 |
| `new_goal` | 不带 digests · 强调 profile + boundaries |
| `retro_request` | 必带 digests（最近 7 天所有摘要） |
| `goal_adjust` | 必带 specific goal snapshot + 该目标相关 digests |
| `small_talk` | 最精简：system + profile + recent 3 |

调整实现为"级别重映射函数"：

```ts
function rebalance(base: Plan, intent: Intent): Plan;
```

---

## 7. Token 预算与估算

- 使用 `tiktoken` 对 system prompt 精确计数
- 用户消息 + 历史：英文 ~1 token/4 char，中文 ~1 token/1.5 char，近似足够
- 每个段落 `estimate()` 返回 `{ tokens, content }`
- `pack` 按级别降序丢弃直到 `sum ≤ budget`

```ts
interface Segment {
  id: SegmentId;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  content: string;
  tokens: number;
  mustKeep: boolean;
}
```

**溢出保护**：若级别 0–1 的必保段已 > budget，返回错误给 conversation 模块，由 conversation 降级（截断 last 3 到 last 1）。

---

## 8. 性能指标

| 操作 | 目标 |
|:---|:---|
| `build` 总耗时 | < 80 ms（不含 intent LLM 调用） |
| 含 intent LLM | < 300 ms |
| 并行 fetch 阶段 | < 40 ms |
| pack | < 5 ms |

---

## 9. 与 OpenClaw 对照

| OpenClaw context-manager | LevelUp context |
|:---|:---|
| `reserveTokens: 130000` | `budget: 2000`（尺度不同，思路一致） |
| `keepRecentTokens: 15000` | `recent_3` 必保 |
| `postCompactionSections` | level 0–1 必保段 |
| `memoryFlush.prompt` | digestWriter 异步落盘 |
| `qualityGuard.maxRetries` | persona.validateResponse 重试 |

---

## 10. 测试要点

- **单测**：每个 intent 的装配计划快照
- **预算测**：随机构造 100 种 (profile 大小 · 历史长度 · 检索命中数) 组合，断言总 token ≤ budget
- **必保测**：即便所有可弃段撑爆，system + profile + user_msg 永远在 packet 里
- **性能测**：build 耗时 p95 < 80ms
- **快照测**：相同输入 → 相同输出（幂等）

---

## 11. 风险

| 风险 | 缓解 |
|:---|:---|
| tiktoken 对中文估算偏差 | 为中文补一个保守系数 × 1.1 |
| intent 分类错误导致装配偏 | 规则走不过再走 LLM · 日志记录所有分类 · 周度 review |
| 并行 fetch 某个慢 | 设置 50ms 超时 · 超时的可弃段跳过，必保段抛错 |
| 用户消息本身超预算 | 截断用户消息到 1500 tokens · 保留首尾 |

---

## 12. 依赖

| 依赖 | 用于 |
|:---|:---|
| `persona` | buildSystemPrompt |
| `memory` | readProfile / readGoals / searchDigests / readTrend |
| `conversation` | tail(N) |
| `llm`（仅 intent 分类 · 可选） | 不确定意图时兜底 |
