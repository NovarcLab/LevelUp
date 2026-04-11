# Roadmap Viz · 全局路线图（Phase 2）

> PRD F7 · ui.pen frame 13。
> 产品的"哇时刻"。MVP 不做，Phase 2 启动。

---

## 1. 目标

- 把多个 goal 的 milestones 按周排列到同一视觉平面
- 当前所在位置高亮
- 不做可编辑，只做可视化（编辑走对话）

---

## 2. 布局

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  LEVEL 1 — GOALS                 W13 W14 W15 W16   │
│  ▪  Side Project MVP              ──────●───       │
│  ▪  Daily 500 words               ─●─────────      │
│                                                    │
│  LEVEL 2 — MILESTONES                              │
│  Side Project                                      │
│    Scope doc       [done W11]                      │
│    MVP doc         [in progress 58% W14]           │
│    Prototype       [W16]                           │
│    First user test [W18]                           │
│                                                    │
└────────────────────────────────────────────────────┘
```

- 水平轴：ISO weeks（动态窗口：当前 ±6 周）
- 垂直轴：goals 分组，各 goal 下展开其 milestones
- 当前周用 1px accent 纵线贯穿

---

## 3. 交互

| 操作 | 行为 |
|:---|:---|
| hover milestone | 显示 popover：标题 · 状态 · 完成时间 |
| click milestone | 注入对话："Let's talk about this milestone." |
| 滚轮横向 | 窗口平移 |
| 键盘 ←→ | 平移一周 |

---

## 4. 实现

- Canvas 或 SVG？**SVG** · 可用 CSS variables 做主题 · 无需 retina 处理
- 单文件组件 `<Roadmap goals={...} />`
- 数据源：`goal-tree.listActiveGoals` 一次性拉全
- 视口外 milestone 不渲染（虚拟化简化版）

---

## 5. 打开方式

- ⌘M / 命令面板 `Show full roadmap`
- 进入 Drawer（宽度 1000px，比 goal-detail 更宽）
- Esc 关闭

---

## 6. 测试要点

- 多 goal 布局不重叠
- 当前周线定位准确
- Hover / click 交互
- 虚拟化：100 milestones 不掉帧

---

## 7. 依赖

- `goal-tree` · `shell` · `design-system` · `motion`
