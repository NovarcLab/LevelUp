# Command Bar · ⌘K

> 整个产品的核心交互入口。Raycast / Linear 风格。

---

## 1. 目标

- 实现 ui.md §8.4 + §7.3 动效
- 目标切换 + 命令执行 + 模糊搜索
- 键盘优先，鼠标可用

---

## 2. 数据源

命令面板有两类条目：

| 分组 | 来源 | 快捷键 |
|:---|:---|:---|
| GOALS | goal-tree.listActiveGoals | ⌘1 ⌘2 ... |
| ACTIONS | 静态命令表 | ⌘N / ⌘R / ⌘M / ⌘⌫ |

```ts
const actions: CommandAction[] = [
  { id: 'new-goal', label: 'New goal', key: '⌘N', run: () => conversation.send('/新目标') },
  { id: 'retro', label: 'Weekly reflection', key: '⌘R', run: () => conversation.send('/复盘') },
  { id: 'roadmap', label: 'Show full roadmap', key: '⌘M', run: () => drawer.open({ type: 'roadmap' }) },
  { id: 'archive', label: 'Archive current goal', key: '⌘⌫', run: () => goalTree.archiveCurrent() },
];
```

---

## 3. UI

基于 `cmdk`：

```
┌────────────────────────────────────────────────┐
│  >  ________________________                  │
│  ──────────────────────────────────────────    │
│  GOALS                                         │
│  ▪  Side Project MVP              ⌘1           │
│  ▪  Daily 500 words               ⌘2           │
│                                                │
│  ACTIONS                                       │
│  +  New goal                      ⌘N           │
│  ↻  Weekly reflection             ⌘R           │
│  ──────────────────────────────────────────    │
│  ↑↓ navigate   ↵ select   esc close            │
└────────────────────────────────────────────────┘
```

- 宽 560px · 屏幕中心
- `bg-bg-glass backdrop-blur-[32px] shadow-pop rounded-lg`
- 边框 1px line-1
- 每项 6px 方点或线形 icon + 右侧 `<Kbd>`

---

## 4. 动效

ui.md §7.3：

```
触发 ⌘K:
  1. 覆盖层 bg-glass + blur(12) · 0 → 1 · 200ms
  2. 面板从中心 scale 0.96 → 1 · opacity 0 → 1 · 280ms ease-spring
  3. 第一项延迟 80ms 淡入

关闭 Esc:
  反向 · 160ms · ease-in
```

---

## 5. 搜索

`cmdk` 内置模糊匹配。中文用 pinyin-pro 预处理（拼音首字母 + 全拼）。

---

## 6. 特殊模式

- `token_expired` → 被替换为登录输入（邮箱 + 密码），不能关闭
- `commands_only`（⌘/）→ 隐藏 GOALS 分组

---

## 7. 测试要点

- 快捷键触发 / 关闭
- 上下键导航 · 回车执行
- 模糊搜索命中中文拼音
- token_expired 模式下 Esc 不关

---

## 8. 依赖

- `design-system` — LineInput · Kbd
- `motion` — 弹入弹出
- `goal-tree` — GOALS 数据
- `conversation` — 命令执行
- `shell` — 全局快捷键钩入
