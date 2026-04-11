# Motion · 动效库

> ui.md §5 §7 §10 的可运行版本。
> 动效是界面的一部分，不是锦上添花。

---

## 1. 目标

- 复用 7 套核心动效 + 15 个微交互
- 尊重 `prefers-reduced-motion`
- 性能：60fps · 只动 transform / opacity

---

## 2. 技术

- **Motion (Framer Motion 后继)**：大部分动效
- **CSS animations**：呼吸背景、光标呼吸
- **IntersectionObserver**：滚动触发

---

## 3. 常量

`packages/motion/src/tokens.ts`：

```ts
export const duration = {
  fast: 120, base: 200, mid: 320, slow: 480, breath: 6000,
};

export const ease = {
  out: [0.16, 1, 0.3, 1],
  in:  [0.7, 0, 0.84, 0],
  io:  [0.87, 0, 0.13, 1],
  spring: [0.5, 1.3, 0.5, 1],
};
```

---

## 4. 核心动效库

### 4.1 `<AmbientHalo>`

```tsx
<AmbientHalo intensity={0.7} />
```

实现见 ui.md §7.1：
- 径向渐变 200vmin 绝对定位
- `opacity 0.4 ↔ 0.7` + `scale 1 ↔ 1.08` · 6s ease-io
- `translate` perlin 20s linear
- `filter: blur(80px)`

用途：Onboarding · 空状态 · 迷失重锚

### 4.2 `<WordStream>`

```tsx
<WordStream text={aiReply} />
```

- 按**词**切分（中文按字）
- 每词：opacity 0→1 · blur 6→0 · Y 4→0 · 180ms ease-out
- 词间延迟 60ms · 句末 (。 . ?) 延迟 240ms
- 不显示光标

### 4.3 `<CardPush>`

```tsx
<CardPush>
  <Card .../>
</CardPush>
```

- 0–200ms：骨架（bg-2 色块）
- 200ms：内容替换 · Y 12→0 · opacity 0→1 · 280ms ease-out
- 进度条：延迟 120ms · width 800ms ease-io · 完成后 glow 600ms

### 4.4 `<SidebarSlide>`

Framer `animate={{ width: collapsed ? 56 : 280 }}` · 320ms ease-io
子项 `AnimatePresence` stagger 30ms · Y -8 → 0 · opacity 0 → 1 · 200ms

### 4.5 `<CommandBarRise>`

见 command-bar §4，封装为 variants：

```ts
const variants = {
  hidden: { scale: 0.96, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.28, ease: 'spring' }},
  exit: { scale: 0.96, opacity: 0, transition: { duration: 0.16, ease: 'in' }},
};
```

### 4.6 `<MilestoneFlash>`

ui.md §7.7 完整时间线：

```ts
async function milestoneFlash(cardEl: HTMLElement) {
  await animate(cardEl, { scale: [1, 1.01] }, { duration: 0.28, ease: 'out' });
  await delay(200);
  await emitScreenRing();                        // 屏幕边缘 1px accent
  await delay(200);
  await updateDotColor('accent');
  await delay(200);
  await showInlineLabel('MILESTONE COMPLETE');
  await delay(600);
  await animate(cardEl, { scale: 1 }, { duration: 0.3 });
  await delay(1500);                             // 停顿即仪式
}
```

### 4.7 `<ErrorPulse>`

- 底线颜色 `line-1 → signal → line-1` · 1000ms ease-io
- caption 提示 3s 后淡出

---

## 5. 微交互钩子

```ts
useUnderlineFromLeft(ref)   // hover 链接下划线
useCardHoverLift(ref)       // 卡片 hover
useCounterRoll(value)       // 数字滚动 · tabular-nums · 600ms
useFocusBottomLine(ref)     // 输入底线
```

---

## 6. reduced-motion

全局 provider：

```ts
const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
```

命中时：
- AmbientHalo 静止（opacity 固定 0.5）
- WordStream 全量一次性显示
- 滑动 / scale 改为 opacity only
- CounterRoll 改直接赋值

---

## 7. 测试要点

- Playwright video capture · 对关键动效做时长断言
- reduced-motion 分支快照
- 帧率：开 Chrome trace 验证 60fps

---

## 8. 依赖

- `motion`（npm 包）
- `design-system` — tokens
