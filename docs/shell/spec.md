# Shell · 应用外壳

> TopBar · Sidebar · Drawer 三件套。产品唯一的常驻 UI。

---

## 1. 目标

- 实现 ui.md §8.2 主界面、§8.3 Sidebar 双态、§9.7 抽屉系统
- 全局快捷键 hub（⌘K / ⌘B / ⌘Enter / Esc / ⌘/）
- 主题切换控制点

---

## 2. 组成

```
<AppShell>
  <TopBar />
  <div className="flex flex-1">
    <Sidebar />
    <Main>{children}</Main>
  </div>
  <DrawerHost />      ← 全局抽屉栈
  <CommandBarHost />  ← 由 command-bar 模块渲染
</AppShell>
```

---

## 3. TopBar

高度 48px · `bg-bg-0 border-b border-line-1`

左：品牌符号 `▪ LEVELUP · {当前会话的目标上下文}`
右：`⌘K ⚙`

- 滚动时背景变 `bg-glass` + blur（ui.md §10 微交互）
- 不显示用户头像
- 品牌符号 hover 不变色

---

## 4. Sidebar

### 4.1 双态

| 态 | 宽 | 触发 |
|:---|:---|:---|
| 折叠 | 56px | 默认 / ⌘B |
| 展开 | 280px | ⌘B / 点击边缘 |

状态存 `localStorage.sidebar`，SSR 时读 cookie 预置。

### 4.2 折叠态

- 目标状态方点列（6×6）
- Hover 300ms 后右侧浮层 tooltip
- 底部 `+` ghost 图标

### 4.3 展开态

- 顶部 caption `GOALS`（tracking 0.1em · fg-2）
- 目标卡片列表（`bg-bg-1 border border-line-1 rounded-md p-4`）
  - `<Dot>` + h3 goal title
  - small fg-1 current milestone
  - `<ProgressTrack>`
- 底部：`+ NEW GOAL`（accent · caption · hover 下划线）

### 4.4 交互

| 操作 | 行为 |
|:---|:---|
| 单击目标 | 注入对话上下文 → conversation 新会话 contextGoalId |
| 右键 / 长按 | Popover: 编辑 · 归档 · 删除 |
| 拖动 | 重排（display_order） |
| `+ NEW GOAL` | 触发命令面板 `/新目标` |

### 4.5 滑出动效

ui.md §7.5：
- width 56 → 280 · 320ms ease-io
- blur 16 → 20
- 目标项 stagger 30ms 依次淡入

---

## 5. Drawer（Sheet）

全局栈式管理：

```ts
interface DrawerHost {
  open(drawer: DrawerDescriptor): void;
  close(id?: string): void;
  stack: DrawerDescriptor[];
}

type DrawerDescriptor =
  | { id: string; type: 'goal-detail'; goalId: string }
  | { id: string; type: 'settings'; section?: string }
  | { id: string; type: 'memory-inspector' };
```

- 右滑入 · 480px · 320ms
- 多层堆叠时后一层向左推 40px
- Esc 关闭最顶层

---

## 6. 全局快捷键

```ts
useShortcut('meta+k', () => commandBar.open());
useShortcut('meta+b', () => sidebar.toggle());
useShortcut('meta+/', () => commandBar.open({ mode: 'commands' }));
useShortcut('escape', () => drawerHost.close());
```

Mac `meta`，Win/Linux `ctrl`（cross-platform 包装）。

---

## 7. 主题切换控制

- 22:00 检测：light 模式 → 顶栏底部显示 caption 提示（24h 内只提一次）
- 点击 ⚙ 进入 settings 抽屉 · 内部有主题切换

---

## 8. 测试要点

- Sidebar 双态快照
- ⌘B / ⌘K / Esc 快捷键不与输入冲突（input focus 时仅 Esc 生效）
- Drawer 栈行为：开三层 → Esc 三次依次关

---

## 9. 依赖

- `design-system` — primitives
- `motion` — sidebar slide · drawer slide
- `command-bar` — ⌘K
- `goal-tree` — 目标列表数据
