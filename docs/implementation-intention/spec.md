# Implementation Intention · 实施意图

> "当 X 时我就 Y，直到 Z。"
> Gollwitzer 1999 的方法论产品化。

---

## 1. 目标

- 对接 PRD §F3
- 结构化生成 + 校验 + 生命周期
- 成功/失败次数累积，供 trends 分析

---

## 2. Schema

```sql
CREATE TABLE implementation_intentions (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  behavior TEXT NOT NULL,
  termination TEXT NOT NULL,
  fallback TEXT,
  status TEXT NOT NULL CHECK(status IN ('active','retired')),
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  retired_at INTEGER
);

CREATE INDEX idx_ii_action_active
  ON implementation_intentions(action_id, status);
```

**约束**：一个 action 同时只有一条 `status='active'` 的 ii。

---

## 3. 生成规则

所有字段必须通过校验：

| 字段 | 校验 |
|:---|:---|
| trigger | 包含时间/地点/事件/情绪之一的可识别信号 · 不能是"有空时" |
| behavior | 动词开头 · 5 分钟内可启动 · 不能是"写作"（太抽象） |
| termination | 可观察（时长/页数/完成某节）· 不能是"感觉做完" |
| fallback | 可选 · 同样满足上述规则 |

校验用 LLM + 规则双层：

```ts
interface IIValidator {
  validate(ii: IIDraft): Promise<{ ok: boolean; issues: Issue[] }>;
  suggest(action: Action, profile: Profile): Promise<IIDraft>;
}
```

不合格时 LLM 被要求重写（最多 2 次）。

---

## 4. 接口

```ts
export interface ImplementationIntentionEngine {
  generate(actionId: string): Promise<II>;
  replace(actionId: string, draft: IIDraft): Promise<II>;
  recordSuccess(iiId: string): Promise<void>;
  recordFail(iiId: string): Promise<void>;
  retireIfStale(iiId: string): Promise<void>;     // fail_count 增至 3 自动建议重写
  listHistory(actionId: string): Promise<II[]>;
}
```

---

## 5. 渲染（卡片内）

```
┌──────────────────────────────────────────┐
│  THE BINDING                             │
│                                          │
│  When it's 9pm and I sit at the desk,    │
│  I open the doc and fill the scope       │
│  section, until the 25-min timer ends.   │
│                                          │
│  Fallback · Saturday 10am                │
└──────────────────────────────────────────┘
```

三行缩进结构，accent 色的 "THE BINDING" label。

---

## 6. 失败路径

- `fail_count` 增长触发 PRD "连续 3 次漏做" 分支
- conversation 收到信号 → persona.calibrate(directness +5) → AI 主动发起微调
- AI 询问后可能：
  - `replace` 换触发条件
  - `retire` + 重新 `generate`

---

## 7. 测试要点

- 校验覆盖坏样本（"有空时"、"努力一点"、"感觉做完"）
- 生命周期：生成 → 记成功 → 记失败 → 自动退休 → 新生成
- 同 action 多 active ii 约束

---

## 8. 依赖

- `llm` — 生成 / 重写
- `goal-tree` — action 作为宿主
- `persona` — 失败信号反馈
