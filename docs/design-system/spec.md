# Design System · 设计系统

> ui.md 是设计规范，design-system 模块是它的可执行落地。
> 一次写完，整个产品 import 它。

---

## 1. 目标

- 把 ui.md §2–6, §9, §14 翻译为可运行的 Tailwind + CSS variables + React primitives
- 所有颜色 / 间距 / 圆角 / 动效只在这里定义一次
- 暗模式默认，亮模式可切
- 组件极简：一个 `<Button variant="primary">`，不做 40 个 prop 的万能组件

**非目标**
- 不做 Storybook（避免双仓库）
- 不做主题市场
- 不做 `sx` / `styled-components` / emotion

---

## 2. 技术选型

- **Tailwind CSS v4**：用 `@theme` 直接接入 CSS variables
- **CSS variables**：token 真相源
- **Radix UI Primitives**：无样式的 Dialog / Popover / Tooltip / DropdownMenu
- **clsx + tailwind-merge**：`cn()` helper
- **cmdk**：command bar 库
- **lucide-react**：线形几何图标（PRD 禁用 emoji）

---

## 3. Token 文件

`apps/web/styles/tokens.css`

完全对应 ui.md §14：

```css
@layer base {
  :root {
    /* Color · Light */
    --bg-0: #FAFAFA;
    --bg-1: #FFFFFF;
    --bg-2: #F4F4F5;
    --bg-glass: rgba(255,255,255,0.72);

    --fg-0: #09090B;
    --fg-1: #52525B;
    --fg-2: #A1A1AA;
    --fg-3: #D4D4D8;

    --line-1: rgba(9,9,11,0.06);
    --line-2: rgba(9,9,11,0.10);

    --accent: #3B82F6;
    --accent-glow: rgba(59,130,246,0.24);
    --signal: #F97316;

    /* Space */
    --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;
    --sp-4: 16px; --sp-5: 20px; --sp-6: 24px;
    --sp-8: 32px; --sp-10: 40px; --sp-12: 48px;
    --sp-16: 64px;

    /* Radius */
    --r-xs: 4px; --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-full: 9999px;

    /* Motion */
    --t-fast: 120ms;
    --t-base: 200ms;
    --t-mid:  320ms;
    --t-slow: 480ms;

    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-in:  cubic-bezier(0.7, 0, 0.84, 0);
    --ease-io:  cubic-bezier(0.87, 0, 0.13, 1);

    --shadow-pop: 0 0 0 1px var(--line-1), 0 16px 48px rgba(0,0,0,0.12);

    /* Type */
    --font-sans: 'Inter', -apple-system, system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', 'Geist Mono', monospace;
  }

  [data-theme="dark"] {
    --bg-0: #09090B;
    --bg-1: #18181B;
    --bg-2: #27272A;
    --bg-glass: rgba(24,24,27,0.76);

    --fg-0: #FAFAFA;
    --fg-1: #A1A1AA;
    --fg-2: #71717A;
    --fg-3: #52525B;

    --line-1: rgba(255,255,255,0.06);
    --line-2: rgba(255,255,255,0.10);

    --accent: #60A5FA;
    --accent-glow: rgba(96,165,250,0.32);
    --signal: #FB923C;
  }
}

@theme {
  --color-bg-0: var(--bg-0);
  --color-bg-1: var(--bg-1);
  --color-bg-2: var(--bg-2);
  --color-fg-0: var(--fg-0);
  --color-fg-1: var(--fg-1);
  --color-fg-2: var(--fg-2);
  --color-fg-3: var(--fg-3);
  --color-accent: var(--accent);
  --color-signal: var(--signal);

  --radius-xs: var(--r-xs);
  --radius-sm: var(--r-sm);
  --radius-md: var(--r-md);
  --radius-lg: var(--r-lg);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}
```

Tailwind v4 之后可以直接 `bg-bg-1 text-fg-0 rounded-md` 使用。

---

## 4. 字体

- Self-host 三个 woff2：`Inter-Regular/Medium/Semibold.woff2`
- 中文 fallback 用系统 PingFang SC / 思源黑体（不打包）
- `next/font/local` 加载，preload 主字重
- **FOUT**：`font-display: swap`
- 禁用 tabular lining：对数字列使用 `tabular-nums`

---

## 5. Primitive 组件清单

所有组件在 `apps/web/components/primitives/`。

### 5.1 Button

```tsx
type ButtonProps = {
  variant: 'primary' | 'ghost' | 'text';
  size?: 'md' | 'sm';
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};
```

- **primary**：`bg-accent text-white rounded-sm px-5 py-2.5 font-medium hover:brightness-110 active:scale-[0.98] transition-all duration-[120ms]`
- **ghost**：`border border-[var(--line-1)] hover:bg-bg-2`
- **text**：纯文字 + 可选 `<ArrowRight>` · hover 下划线从左滑入（motion 模块提供）

一屏最多一个 primary。

### 5.2 LineInput

```tsx
<LineInput
  value={value}
  onChange={setValue}
  placeholder="告诉我你今天的进展"
  prefix={<Caret />}
  suffix={<Kbd>⌘↵</Kbd>}
  autoFocus
/>
```

- 无边框无背景
- 底部 1px line-1
- focus → accent（200ms）
- 光标 2px accent · 800ms 呼吸（仅 onboarding 与输入区）

### 5.3 BoxedInput

仅用于设置表单等次要场景。`bg-bg-1 border border-line-1 rounded-xs px-3 py-2.5 focus:border-accent`

### 5.4 Dot

```tsx
<Dot status="active" | "idle" | "stuck" | "near-done" | "done" | "archived" />
```

固定 6×6 正方形（`rounded-none`），不是圆。颜色映射见 ui.md §9.5。

### 5.5 ProgressTrack

```tsx
<ProgressTrack value={58} />
```

- 轨道 1px `bg-line-1`
- 填充 1px `bg-accent`
- 右侧 tabular-nums caption 数字
- value 变化时 800ms ease-io 补间
- 100% 时 800ms glow

### 5.6 Kbd

```tsx
<Kbd>⌘K</Kbd>
```

`bg-bg-2 border border-line-1 rounded-xs px-1.5 py-1 text-[11px] font-medium text-fg-1`

### 5.7 Sheet（侧滑抽屉）

基于 Radix Dialog。

- 从右滑入，宽 480px，320ms ease-io
- `bg-bg-1`，左边框 1px line-1
- 覆盖层 `rgba(0,0,0,0.4) backdrop-blur-sm`
- Esc / 点击覆盖层 / 右上 × 关闭

### 5.8 Popover / Tooltip

基于 Radix Popover / Tooltip。

- `bg-bg-glass backdrop-blur-[20px] shadow-pop rounded-md p-4`

### 5.9 Caption / Label

`text-[12px] tracking-[0.02em] uppercase text-fg-2 font-medium`

### 5.10 Glass

一个 wrapper 组件，给 shell 和 command-bar 用：

```tsx
<Glass>
  ...
</Glass>
```

`bg-bg-glass backdrop-blur-[20px] saturate-150`

---

## 6. Typography Scale

对应 ui.md §3.2：

```css
.t-display  { font-size: 56px; line-height: 64px; letter-spacing: -0.03em; font-weight: 500; }
.t-h1       { font-size: 36px; line-height: 44px; letter-spacing: -0.02em; font-weight: 600; }
.t-h2       { font-size: 24px; line-height: 32px; letter-spacing: -0.015em; font-weight: 600; }
.t-h3       { font-size: 18px; line-height: 26px; letter-spacing: -0.01em; font-weight: 600; }
.t-body     { font-size: 14px; line-height: 22px; letter-spacing: -0.005em; font-weight: 400; }
.t-small    { font-size: 13px; line-height: 20px; font-weight: 400; }
.t-caption  { font-size: 12px; line-height: 16px; letter-spacing: 0.02em; text-transform: uppercase; font-weight: 500; }
```

只用 Regular / Medium / Semibold 三个字重。禁用 Bold / Light。

---

## 7. 主题切换

`ThemeProvider` 组件：

```tsx
<ThemeProvider defaultTheme="dark">
  {children}
</ThemeProvider>
```

- 默认 `dark`
- 用户手动切换后存 `localStorage.theme`
- 切换动效：`opacity 1 → 0.2 → 1`（320ms 总时长，见 ui.md §12.2）
- 22:00 后亮模式 → 顶栏提示切换（由 shell 模块实现）

---

## 8. 图标

```tsx
import { ArrowRight, Plus, Settings, ChevronDown } from 'lucide-react';
```

- 只用 lucide
- size 默认 16，stroke-width 1.75（线形感）
- 禁用彩色图标

---

## 9. 反模式清单（在 lint 里固化）

`eslint-plugin-levelup` 自定义规则：

- `no-emoji-in-jsx`：禁止在 `<>` 中字面写 emoji
- `no-system-fonts`：禁止 `font-family: -apple-system`（必须走变量）
- `no-hex-color`：禁止字面量颜色（必须用 token）
- `no-box-shadow`：除了 `shadow-pop` 外禁用阴影
- `no-bold-700`：禁用 `font-bold`
- `no-rounded-full-on-squares`：Dot 必须是直角

---

## 10. 测试要点

- **视觉回归**：Playwright 截图每个 primitive 的所有状态，像素 diff
- **a11y**：axe-core 跑每个 primitive 的 Storybook-less 页面 `/dev`
- **主题测试**：`toggleTheme()` 后所有组件仍合规
- **token drift 测试**：grep 所有 `.tsx`，确保没有硬编码颜色 / 间距

---

## 11. 风险

| 风险 | 缓解 |
|:---|:---|
| Tailwind v4 刚发布生态不稳 | 钉死 minor 版本 · 有问题退回 v3.4 |
| 字体文件大拖慢首屏 | subset 中英文常用字符 · CDN 压缩 |
| 暗模式切换闪烁 | SSR 读 cookie 预置 `data-theme` |
| 自定义 lint 维护成本 | 从 5 条起步，按需加 |

---

## 12. 依赖

| 依赖 | 用于 |
|:---|:---|
| `motion` | 动效 hooks · Button hover · word stream |
| 无后端依赖 | 纯前端基建 |
