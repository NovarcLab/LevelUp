# Card · 对话内嵌卡片

> 卡片是系统向对话的投射。用户不手动插卡，只有 AI 决定何时浮现。

---

## 1. 目标

- 实现 PRD §F4 五类卡片 + §11.3 决策表
- 密度规则兜底（单次对话 ≤2 · 同类 1h 去重 · 相邻间隔 ≥3）
- 前端渲染严格遵从 ui.md §9.4

---

## 2. 五类卡片

| ID | 类型 | 触发 | 核心字段 |
|:--|:---|:---|:---|
| C1 | progress | 用户反馈完成/推进 | goalTitle, percent, nextStep |
| C2 | locate | 用户问"我在哪里" | goalTitle, pathTrail, currentNode |
| C3 | status | 用户提及某目标 | goalTitle, currentMilestone, recentAction |
| C4 | summary | 间隔 >3 天首条回复 / 复盘 | goals[] (title, percent, headline) |
| C5 | encourage | 情绪词命中 | doneActions[], days |

---

## 3. Payload 契约（共享类型）

```ts
type CardPayload =
  | { type: 'progress'; goalId: string; title: string; percent: number; nextStep: string; cta?: Cta }
  | { type: 'locate'; goalId: string; trail: string[]; currentNode: string }
  | { type: 'status'; goalId: string; title: string; currentMilestone: string; recentAction: string }
  | { type: 'summary'; goals: { id: string; title: string; percent: number; headline: string }[] }
  | { type: 'encourage'; doneActions: { title: string; at: string }[]; days: number };

type Cta = { label: string; action: 'open_goal' | 'start_retro' | 'show_roadmap' };
```

存储在 `messages.embedded_cards` 列（JSON 数组，通常 0–1 条）。

---

## 4. 决策引擎

```ts
export interface CardDecisionEngine {
  decide(input: CardInput): Promise<CardPayload | null>;
}

interface CardInput {
  userMessage: string;
  assistantText: string;         // AI 刚生成的文本（用于避免重复）
  intent: Intent;
  history: Message[];            // 最近 10 条
  activeGoals: GoalSnapshot[];
  lastCardAt?: number;           // 最近一张卡片时间
}
```

### 决策流程

```
1. signals = extractSignals(userMessage, intent, history)
2. candidates = match signals with §11.3 table
3. 过滤：
     · 密度规则（1h 去重 · 相邻 ≥3）
     · activeGoals 里找不到目标 → 剔除
4. pick highest priority
5. payload = fillFromGoalTree(candidate)
6. return payload | null
```

**决策是纯函数 + DB 只读查询**，不调 LLM（除非需要为 C5 生成短 headline）。

---

## 5. 前端渲染

`apps/web/components/cards/`

```tsx
<CardFrame>
  <CardHeader>
    <Dot status="active" />
    <h3 className="t-h3">Side Project MVP</h3>
  </CardHeader>
  <ProgressTrack value={58} />
  <CardMeta label="Current" value="Finish MVP document" />
  <CardCta>→ View full path</CardCta>
</CardFrame>
```

- 宽度 560px · 内边距 24
- `bg-bg-1 border border-line-1 rounded-md`
- 默认折叠态约 3 行高 · 点击展开
- 动效 §7.4：入场 Y 12→0 · opacity 0→1 · 280ms
- 进度条延迟 120ms 填充 800ms

---

## 6. 测试要点

- **密度规则测**：构造 20 条消息历史，断言决策结果符合 §F4 规则
- **signal 提取测**：50 条真实消息样本 → 正确 intent/card 命中
- **渲染测**：每类 card 截图
- **无目标兜底**：activeGoals 空时 C1/C3 返回 null

---

## 7. 依赖

- `goal-tree` — activeSnapshot
- `memory` — C5 doneActions 来自 digests 检索
- `llm`（可选）— C5 headline 生成
