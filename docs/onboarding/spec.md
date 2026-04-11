# Onboarding · 开场剧场

> 前 60 秒是产品的第一次表达。不是 flow，是 theater。

---

## 1. 目标

- 实现 ui.md §8.1 五场景（对应 ui.pen frame 1–4 + 承接）
- 对接 PRD §F2 建档五步
- 零按钮 · 零跳过 · 零进度条

---

## 2. 场景序列

| # | 名 | 时长 | 关键元素 |
|:--|:---|:---|:---|
| S1 | 黑 | 1200ms | 全屏 bg-0，无任何元素 |
| S2 | 光 | 1600ms | AmbientHalo 渐入 + 4×4 accent 方块 |
| S3 | 初问 | ∞ | "What should I call you?" + LineInput |
| S4 | 识别 | word stream | "Hello, {name}. ..." |
| S5 | 承接 | 600ms | halo 扩散 + 主界面淡入 |

### S5 之后：建档 5 步

直接接入 PRD §F2：
- Step 1 · 锚定意义
- Step 2 · 定义完成
- Step 3 · 拆里程碑
- Step 4 · 聚焦本周
- Step 5 · 绑定情境

建档全部在**对话形式**里完成，不用向导 UI。AI 按顺序发问，用户回答，goal-tree 实时写库。

---

## 3. 状态机

```ts
type OnboardingState =
  | { scene: 'S1' }
  | { scene: 'S2' }
  | { scene: 'S3' }
  | { scene: 'S4'; name: string }
  | { scene: 'S5'; name: string; initialGoalRaw: string }
  | { scene: 'building'; step: 1|2|3|4|5; draft: BuildDraft };
```

存 `data/workspaces/user-{id}/onboarding.json`，允许中断恢复。

---

## 4. 建档 draft

```ts
interface BuildDraft {
  title?: string;
  whyStatement?: string;
  targetCompletionDate?: number;
  dodText?: string;
  milestones?: { title: string; targetWeek: number }[];
  focusMilestoneIndex?: number;
  actions?: { title: string; weekOf: string }[];
  ii?: IIDraft;
}
```

每步完成后持久化 draft。S5 建档完成时一次性 tx 写入 goals/milestones/actions/ii。

---

## 5. 交互细节

| 细节 | 规则 |
|:---|:---|
| S3 输入框 | 无 placeholder · 无按钮 · 回车提交 |
| S4 word stream | ui.md §7.2 · 按词淡入 180ms · 词间 60ms · 句末 240ms |
| 建档中"pause" | 用户说 pause → 退出建档 · draft 保留 · 主界面可见（目标空） |
| 建档中"skip step" | AI 承认但继续推进（不是真跳过 · 把该步打空） |
| 退出后重进 | 下次打开直接进入 building 对应 step |

---

## 6. 特殊：无跳过

- Scene 1–3 期间按键全部忽略除 Return
- Scene 4 期间 AI 说完前用户不能输入

---

## 7. 测试要点

- 五场景 Playwright 回放 · 每场景时长断言
- 建档中断 → 重开 → 进入正确 step
- draft → tx 原子写入所有四层

---

## 8. 依赖

- `motion` — AmbientHalo · word stream
- `design-system` — LineInput
- `goal-tree` — 最终写入
- `implementation-intention` — Step 5
- `persona` — 建档后初始化 SOUL.md
- `memory` — 建档后写 PROFILE.md
