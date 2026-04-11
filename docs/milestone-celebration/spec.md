# Milestone Celebration · 里程碑庆祝

> 现代极简的庆祝 = 冷光一闪 + 精准停顿 + 一句真诚。
> 不说"太棒了"，不撒 confetti。

---

## 1. 目标

- PRD §F10 · ui.md §7.7 §8.5
- 事件驱动：goal-tree 完成 → 前端播放动效 → AI 停顿后一句话

---

## 2. 触发

```ts
// goal-tree.completeMilestone()
await db.update(milestones).set({ status: 'done', completed_at: now });
eventBus.emit('milestone.completed', { userId, goalId, milestoneId });
```

订阅者：
- conversation（注入下一条 AI 消息的 pre-reply 提示）
- card-decision（不再给 C1，而是触发 celebrate 专用 payload）

---

## 3. 前端

### 3.1 动效（ui.md §7.7）

见 motion §4.6 `milestoneFlash`。整段 1200ms + 1500ms 静止。

### 3.2 庆祝 Card（一次性）

不是 C1-C5 五类之一，而是 `celebrate` 类型：

```ts
{
  type: 'celebrate';
  goalId: string;
  milestoneTitle: string;
  oneLinerQuote?: string;     // AI 生成的"你三周前说..."
}
```

前端收到 `event: card type=celebrate` → 屏幕静止 1.5s → 显示一行文字。

---

## 4. AI 话术

**系统硬性约束**（写进 persona 的 intent hint）：

```
MILESTONE_JUST_COMPLETED:
- Do not say "太棒了" / "恭喜" / "加油".
- One sentence. Factual.
- Reference something they said earlier (pull from digests).
- Example: "You said three weeks ago you might not make it. You did."
```

context.build 在 intent=milestone 时强制带最近 7 天 digests，供 LLM 找到可引用的原话。

---

## 5. 节奏

```
user: "done with the prototype milestone"
  ↓
detect milestone completion signal (goal-tree)
  ↓
front-end: <MilestoneFlash />  (1200ms + 1500ms pause)
  ↓
AI starts WordStream reply (one sentence)
```

**停顿即仪式**。不能急着说话。

---

## 6. 测试要点

- 事件到达 → 动效播放完成后 AI 才开始 stream
- AI 回复必不包含 anti-cliche.md 的词
- 回复必引用 digests 里的某句（简单验证：至少含一个 digest 里出现过的 5+ 字符片段）

---

## 7. 依赖

- `goal-tree` — 事件源
- `conversation` — 回复编排
- `persona` — 约束话术
- `context` — 带 digests
- `motion` — 动效
- `card` — celebrate payload
