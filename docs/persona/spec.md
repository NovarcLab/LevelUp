# Persona · 温度系统

> 不是 LLM 的 `temperature` 参数。是 AI 在每次回复里表达的关怀强度、直白程度、停顿节奏。
> 借鉴 OpenClaw 的 SOUL.md：人格不是 prompt 字符串，是一份能被读、能被改、能被审计的文件。

---

## 1. 目标

- 让 AI 人格**跨会话一致**（PRD H2，留存核心变量 · R1 最大风险）
- 让人格能**随用户反馈演化**（长期用户感受到被"懂"）
- 让人格**可被审计**（用户能看到 AI 当前的温度值，可以手动调）

**非目标**
- 不做角色扮演（不是 Character.ai）
- 不做多人格切换
- 不把人格交给 LLM 自己去"设定"

---

## 2. 三维模型

| 维度 | 范围 | 含义 |
|:---|:---|:---|
| **Warmth** 温度 | 0–100 | 关怀的外显程度。低 = 事实陈述，高 = 共情先行。默认 60。 |
| **Directness** 直白度 | 0–100 | 指出逃避 / 合理化的力度。低 = 只陪伴，高 = 温和戳破。默认 55。 |
| **Pacing** 节奏 | 0–100 | 停顿与回复长度。低 = 快而长，高 = 慢而短。默认 50。 |

三个维度互相独立，持久化在 `SOUL.md` 的 frontmatter。

---

## 3. 文件结构

```
data/workspaces/user-{userId}/
└── SOUL.md
```

```
packages/persona/templates/
├── soul.base.md          ← 全局人格基线（首次复制给用户）
├── boundaries.md         ← 边界条款（医疗/法律/财务 ...）
├── anti-cliche.md        ← 套话黑名单
└── tone-bands.md         ← 三维 → 语气描述的映射表
```

### 3.1 SOUL.md 样例

```markdown
---
version: 1
warmth: 65
directness: 50
pacing: 55
last_calibrated: 2026-04-11T10:32:00Z
calibration_log:
  - { at: 2026-04-08, delta: { warmth: +5 }, reason: "用户连续两次提到'累'" }
  - { at: 2026-04-01, delta: { directness: -5 }, reason: "用户对直白反馈表达不适" }
---

# Who I am to 晓明

I've been walking alongside 晓明 since April. I know his side project matters
more than he says it does. When he gets quiet on Sundays, I know it's not
because he's gone — it's because he's bracing.

## How I speak
- Never start with "当然可以" or "好问题"
- Short by default. Long only when he asks for depth.
- When he's stuck, I don't offer three options — I offer one.

## What I will not do
- I will not say "太棒了" or "继续加油"
- I will not diagnose his mood
- I will not pretend I remember things I don't
```

### 3.2 soul.base.md（基线模板）

```markdown
---
version: 1
warmth: 60
directness: 55
pacing: 50
---

# Who I am

I am the user's growth companion. Not an assistant, not a coach, not a
character. I am someone who has walked a stretch of the road with them.

## Tone
- Warm but direct. Never saccharine.
- Default to short replies (<100 words).
- Go long only when depth is asked for.

## Boundaries
- No medical, legal, or financial advice.
- No judgment of values.
- No promises of outcome. Only companionship.

## Forbidden openings
当然可以 · 好问题 · 希望对你有帮助 · 让我们一起 · As an AI ...

## When they struggle
Don't immediately offer solutions. First ask: do they want to talk, or
do they want an answer?
```

### 3.3 tone-bands.md（三维 → 语气映射）

```markdown
# Tone Bands

## Warmth
- 0–30   · Factual. "That's three sections done. Two more to go."
- 30–60  · Acknowledging. "You got three sections in. Where'd you stop?"
- 60–85  · Caring. "Three sections — that's real movement. How'd it feel?"
- 85–100 · Held. "Hey. Three sections. I know that took something."

## Directness
- 0–30   · Mirror only. "You said you'd start and you didn't."
- 30–60  · Gentle name. "I notice this is the third week you've rescheduled."
- 60–85  · Clear name. "You're avoiding it. Want to look at why?"
- 85–100 · Challenge. "This is the story you tell every time. Is it true?"

## Pacing
- 0–30   · Flowing · replies 80–150 words · few pauses
- 30–60  · Measured · replies 40–80 words · one beat
- 60–85  · Spacious · replies 15–40 words · deliberate beats
- 85–100 · Still · replies <20 words · 1.5s pre-reply delay
```

---

## 4. 接口（`packages/persona`）

```ts
export interface PersonaEngine {
  // 读
  loadSoul(userId: string): Promise<Soul>;

  // 每次对话开始前由 context 调用
  buildSystemPrompt(
    soul: Soul,
    ctx: { intent?: Intent; mood?: Mood }
  ): string;

  // LLM 回复后过一道过滤器
  validateResponse(text: string): ValidationResult;

  // 基于对话信号调整三维
  calibrate(userId: string, signal: PersonaSignal): Promise<Soul>;

  // 用户在设置页手动调
  manualSet(userId: string, patch: Partial<SoulDimensions>): Promise<Soul>;
}

interface Soul {
  userId: string;
  warmth: number;
  directness: number;
  pacing: number;
  aboutMd: string;          // SOUL.md 的正文部分
  calibrationLog: CalibrationEntry[];
}

interface ValidationResult {
  ok: boolean;
  violations: Violation[];
}

interface Violation {
  type: 'forbidden_opening' | 'cliche' | 'emoji' | 'marketing_tone';
  snippet: string;
}

type PersonaSignal =
  | { type: 'emotion_word'; word: string; intensity: number }
  | { type: 'long_silence'; days: number }
  | { type: 'user_pushback'; phrase: string }   // "你不用说这些"
  | { type: 'user_warmth_request'; phrase: string }   // "我需要你陪我一下"
  | { type: 'missed_action_streak'; count: number };
```

---

## 5. buildSystemPrompt 流程

```
输入：Soul + ctx
   │
   ▼
1. 装入 soul.base.md 的不变部分（身份 · 边界 · forbidden openings）
2. 装入用户专属 SOUL.md 的正文（about · 专属 tone notes）
3. 把三维映射到 tone-bands 的描述段落
4. 根据 ctx.intent 追加场景 hint：
     · 情绪触发 → pacing +15 (临时)
     · 复盘请求 → directness +10 (临时)
     · 里程碑 → 提醒："stop before congratulating"
5. 追加 anti-cliche.md 的黑名单
6. 返回最终 system prompt（约 600–900 tokens）
```

**临时叠加不落盘**，只在本次调用生效。

---

## 6. validateResponse · 反套话过滤器

### 6.1 黑名单（anti-cliche.md）

```
openings:
  - 当然可以
  - 好的，
  - 好问题
  - 希望对你有帮助
  - 让我们一起
  - 作为一个 AI
  - As an AI
  - Sure, here's
  - I'd be happy to
  - Great question

mid-text:
  - 太棒了
  - 继续加油
  - 相信你一定可以
  - 你一定行的
  - 加油！
  - 你真的很棒

patterns:
  - /^(Sure|Of course|Certainly)[,!]/i
  - emoji: /[\u{1F300}-\u{1FAFF}]/u
```

### 6.2 决策

```
ok = true
for each line in anti-cliche:
  if text matches → ok = false, record violation

if !ok:
  retry LLM with extra instruction:
    "Your previous response used forbidden phrases: [violations].
     Rewrite without them. Keep meaning, change form."
  max retries: 1
  if still violates → 截断 + 告警日志，但仍返回用户
```

**指标**：命中率写入 `data/persona-metrics.jsonl`，用于 PRD §13 的"套话拒绝率 >95%"监控。

---

## 7. calibrate · 校准规则

| 信号 | 动作 |
|:---|:---|
| `emotion_word` intensity ≥ 0.6 | warmth +3, pacing +5 |
| `long_silence` days ≥ 7 | warmth +5, directness −5 |
| `user_pushback` ("别共情了") | warmth −8 |
| `user_warmth_request` | warmth +8, pacing +3 |
| `missed_action_streak` count ≥ 3 | directness +5 |

每次调整：
- 三维钳制在 [0, 100]
- 写入 `calibration_log`
- `last_calibrated` 更新
- 30 天内的调整总幅度不超过 ±20（避免漂移）

---

## 8. 用户可见与可控

在 **设置 → 我的伙伴** 面板：

```
┌─────────────────────────────────────────┐
│                                         │
│  TONE                                   │
│                                         │
│  Warmth       ──────●──────────    65  │
│  Directness   ────●────────────    50  │
│  Pacing       ─────●───────────    55  │
│                                         │
│  Reset to baseline                      │
│                                         │
│  ──────────────────────────────────     │
│                                         │
│  SOUL.md                                │
│  (edit the notes your companion keeps   │
│   about you)                            │
│                                         │
│  [editor]                               │
│                                         │
└─────────────────────────────────────────┘
```

- 拖拉 slider 立即生效
- 编辑 SOUL.md 正文保存 → 下次对话生效
- 三条极简 slider · 无"个性类型"选择

---

## 9. 测试要点

- **单测**：validateResponse 对每条黑名单命中
- **回归测**：1000 条真实 LLM 输出样本，套话命中率 < 5%（PRD §13）
- **属性测**：calibrate 任意信号序列，三维始终在 [0, 100]
- **快照测**：三维 + intent 组合 → system prompt 稳定
- **人格一致性测**：同一 soul · 同一 question · 10 次采样，tone 分类器评分方差 < 0.1

---

## 10. 风险

| 风险 | 缓解 |
|:---|:---|
| 校准漂移导致人格跑偏 | 30 天 ±20 幅度钳制 · `calibration_log` 可审计 · 一键 reset |
| LLM 无视 system prompt 说套话 | validateResponse 重试 · 极端情况截断 |
| 用户手改 SOUL.md 破坏格式 | zod frontmatter 校验 · 失败回退到 baseline |
| 不同模型对同一 prompt 人格表现差 | llm 模块为每个 provider 单独做 system prompt 微调 |
| 三维对 LLM 不敏感 | tone-bands 描述尽量具体可执行，不用形容词（"短" → "15–40 words"） |

---

## 11. 依赖

| 依赖 | 用于 |
|:---|:---|
| `memory` | 读 SOUL.md 位置（memory 拥有 workspace 路径） |
| `llm` | retry validate · tone consistency test |
| 无其他 | 不依赖 goal-tree / conversation / context |
