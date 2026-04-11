# Goal Tree · 目标层级树

> 四层结构（Goal · Milestone · Action · ImplementationIntention）是产品的方法论骨架。
> SQLite 存关系，每次变更投影一份 `GOALS.md` 给 memory 读。

---

## 1. 目标

- 实现 PRD §F2 的四层建档
- 状态派生：active / at-risk / stuck / near-done
- 每次写操作同步 GOALS.md 镜像

**非目标**
- 不做对话路由（交给 conversation）
- 不写人格化开场（交给 persona）

---

## 2. Schema

```sql
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  why_statement TEXT,
  target_completion_date INTEGER,
  status TEXT NOT NULL CHECK(status IN ('active','paused','completed','archived')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_week_index INTEGER,
  display_order INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','in_progress','done')),
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  week_of TEXT NOT NULL,  -- ISO week string
  status TEXT NOT NULL CHECK(status IN ('pending','in_progress','done','skipped')),
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_goals_user ON goals(user_id, status, display_order);
CREATE INDEX idx_milestones_goal ON milestones(goal_id, display_order);
CREATE INDEX idx_actions_week ON actions(milestone_id, week_of);
```

---

## 3. 派生状态

不存 `derived_status`，每次读时现算：

```ts
function deriveGoalStatus(g: Goal, actions: Action[]): DerivedStatus {
  const lastAction = max(actions, a => a.completed_at ?? 0);
  const daysSince = (now - lastAction) / DAY;
  const missedStreak = countMissedInRow(actions);

  if (progress(g) >= 0.8) return 'near-done';
  if (daysSince > 14 || missedStreak >= 3) return 'stuck';
  if (daysSince > 7) return 'at-risk';
  return 'active';
}
```

派生状态对应 ui.md §9.5 的状态方点颜色。

---

## 4. 接口

```ts
export interface GoalTree {
  createGoal(userId: string, input: CreateGoalInput): Promise<Goal>;
  updateGoal(id: string, patch: Partial<Goal>): Promise<Goal>;
  archiveGoal(id: string, reason?: string): Promise<void>;

  addMilestone(goalId: string, input: CreateMilestoneInput): Promise<Milestone>;
  completeMilestone(id: string): Promise<void>;
  reorderMilestones(goalId: string, ids: string[]): Promise<void>;

  addAction(milestoneId: string, input: CreateActionInput): Promise<Action>;
  markActionDone(id: string): Promise<void>;
  markActionSkipped(id: string): Promise<void>;

  // 查询
  listActiveGoals(userId: string): Promise<GoalWithTree[]>;
  activeSnapshot(userId: string): Promise<GoalSnapshot[]>;      // context 用
  getGoal(id: string): Promise<GoalWithTree>;

  // 投影
  projectToMarkdown(userId: string): Promise<string>;           // → GOALS.md
}
```

---

## 5. GOALS.md 投影样例

```markdown
# Goals · 晓明

_Last synced: 2026-04-11T10:32:00Z_

## Active

### Side Project MVP  ·  58%
> Build a life where I choose what I work on.

- [x] Scope document ~ Mar 18
- [ ] **MVP document (current, 58%)**
    - [ ] Write problem definition — this week, tonight 25min
    - [ ] Write user stories — Thursday
- [ ] Build prototype ~ week 7
- [ ] First user test ~ week 9

### Daily 500 words  ·  80%
- [ ] 12 days streak
```

**写入策略**：
- 事务后 `projectToMarkdown` 重新生成全文
- 原子写 `GOALS.md`
- 触发 `memory.syncGoalsSnapshot`

---

## 6. 建档状态机（对接 onboarding）

```
START
  └─ step1 · 锚定意义 → title + why_statement
  └─ step2 · 定义完成 → target_completion_date + DoD
  └─ step3 · 拆里程碑 → 2–4 milestones
  └─ step4 · 聚焦本周 → 1 milestone → 1–2 actions
  └─ step5 · 绑定情境 → 1 implementation intention
END
```

每步写入一次，中断可从 `onboarding_state` 恢复。

---

## 7. 边界规则

| 情况 | 处理 |
|:---|:---|
| 活跃目标 > 5 | 写入成功 · 返回软警告 · 前端 shell 显示提示 |
| 目标超过 1 年 | 创建前 conversation 层面提示拆阶段 |
| 删除目标 | 软删除 30 天 · 超期物理删除（cron） |
| 归档原因是"放弃" | 写 `why_archived` 字段供 trends 聚合 |

---

## 8. 测试要点

- **单测**：CRUD · deriveGoalStatus 覆盖 4 种状态 · projection 稳定
- **并发测**：同目标两个事务同时加 milestone，display_order 不冲突
- **投影测**：写操作后 GOALS.md 与 SQLite 状态等价

---

## 9. 依赖

| 依赖 | 用于 |
|:---|:---|
| `memory` | syncGoalsSnapshot |
| SQLite / Drizzle | 持久化 |
