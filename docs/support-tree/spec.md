# Support Tree · 目标支撑树（Phase 2）

> PRD F8 · ui.pen frame 14。
> 纵向展示 Level 0 → 4 的完整支撑关系，回答"我现在在哪里"。

---

## 1. 目标

- 单个 goal 的深度视图：Why → Year Goal → Milestones → This Week Actions → Implementation Intention
- 只读 · 用对话完成编辑

---

## 2. 布局（参照 ui.pen frame 14）

```
              LEVEL 0 — THE WHY
          Build a life where I choose
             what I work on.
                    │
              LEVEL 1 — YEAR GOAL
        ┌──────────────────────────┐
        │  ▪  Side Project MVP     │
        └──────────────────────────┘
                    │
   ─────────────────┴──────────────────
   │         │         │         │
  MS1       MS2       MS3       MS4
 [DONE]   [58%]     [W7]      [W9]
              │
        ──────┴──────
       │             │
     Act1          Act2
   [25min       [THU]
    TONIGHT]

            LEVEL 4 — IMPLEMENTATION INTENTION
    ┌────────────────────────────────────────┐
    │  THE BINDING                           │
    │  When it's 9pm and I sit at the desk,  │
    │  I open the doc and fill the scope     │
    │  section, until the 25-min timer ends. │
    └────────────────────────────────────────┘
```

---

## 3. 细节

- 层级间 1px line-2 连接
- 当前节点 accent 边框 + dot
- 完成节点 fg-3 色 + 日期
- 尚未触达节点 line-1 描边

---

## 4. 打开方式

- Sidebar 目标右键 → Show support tree
- 命令面板 → Show support tree for "Side Project MVP"
- Drawer 宽度 960px

---

## 5. 实现

- SVG 结构 + CSS variables
- 数据源：`goalTree.getGoal(id)` 返回带完整层级的 `GoalWithTree`
- 若无 Level 0（用户未填 why_statement）→ 提示 "Add a why" · 点击 → 对话发起

---

## 6. 测试要点

- Goal 无 milestones → 空态
- Goal 无 ii → 只显示 Level 0–3
- 当前节点高亮位置正确

---

## 7. 依赖

- `goal-tree` · `shell` · `design-system`
