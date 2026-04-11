import { nanoid } from 'nanoid';
import type { TenantContext } from '@levelup/tenancy';
import { memoryStore } from '@levelup/memory';
import type {
  Action,
  ActionStatus,
  Goal,
  GoalSnapshot,
  GoalStatus,
  GoalWithTree,
  ImplementationIntention,
  Milestone,
  MilestoneStatus,
} from '@levelup/shared';
import { deriveStatus, percentComplete } from './derived.js';

interface GoalRow {
  id: string;
  title: string;
  why_statement: string | null;
  target_completion_date: number | null;
  status: GoalStatus;
  display_order: number;
  created_at: number;
  updated_at: number;
}

interface MilestoneRow {
  id: string;
  goal_id: string;
  title: string;
  target_week_index: number | null;
  display_order: number;
  status: MilestoneStatus;
  completed_at: number | null;
  created_at: number;
}

interface ActionRow {
  id: string;
  milestone_id: string;
  title: string;
  week_of: string;
  status: ActionStatus;
  completed_at: number | null;
  created_at: number;
}

interface IIRow {
  id: string;
  action_id: string;
  trigger: string;
  behavior: string;
  termination: string;
  fallback: string | null;
  status: 'active' | 'retired';
  success_count: number;
  fail_count: number;
}

function rowToGoal(r: GoalRow): Goal {
  return {
    id: r.id,
    title: r.title,
    whyStatement: r.why_statement,
    targetCompletionDate: r.target_completion_date,
    status: r.status,
    displayOrder: r.display_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToMilestone(r: MilestoneRow): Milestone {
  return {
    id: r.id,
    goalId: r.goal_id,
    title: r.title,
    targetWeekIndex: r.target_week_index,
    displayOrder: r.display_order,
    status: r.status,
    completedAt: r.completed_at,
  };
}

function rowToAction(r: ActionRow): Action {
  return {
    id: r.id,
    milestoneId: r.milestone_id,
    title: r.title,
    weekOf: r.week_of,
    status: r.status,
    completedAt: r.completed_at,
  };
}

function rowToII(r: IIRow): ImplementationIntention {
  return {
    id: r.id,
    actionId: r.action_id,
    trigger: r.trigger,
    behavior: r.behavior,
    termination: r.termination,
    fallback: r.fallback ?? undefined,
    status: r.status,
    successCount: r.success_count,
    failCount: r.fail_count,
  };
}

export interface CreateGoalInput {
  title: string;
  whyStatement?: string | undefined;
  targetCompletionDate?: number | undefined;
}

export interface CreateMilestoneInput {
  title: string;
  targetWeekIndex?: number | undefined;
}

export interface CreateActionInput {
  title: string;
  weekOf: string;
}

export interface CreateIIInput {
  trigger: string;
  behavior: string;
  termination: string;
  fallback?: string | undefined;
}

export const goalTree = {
  async createGoal(ctx: TenantContext, input: CreateGoalInput): Promise<Goal> {
    const id = nanoid(12);
    const now = Date.now();
    const maxOrder = (ctx.db
      .prepare('SELECT COALESCE(MAX(display_order),-1) AS m FROM goals')
      .get() as { m: number }).m;
    ctx.db
      .prepare(
        `INSERT INTO goals
         (id,title,why_statement,target_completion_date,status,display_order,created_at,updated_at)
         VALUES (?,?,?,?, 'active', ?, ?, ?)`,
      )
      .run(
        id,
        input.title,
        input.whyStatement ?? null,
        input.targetCompletionDate ?? null,
        maxOrder + 1,
        now,
        now,
      );
    const row = ctx.db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalRow;
    await syncGoalsToMemory(ctx);
    return rowToGoal(row);
  },

  async updateGoal(
    ctx: TenantContext,
    id: string,
    patch: Partial<Pick<Goal, 'title' | 'whyStatement' | 'targetCompletionDate' | 'status'>>,
  ): Promise<Goal> {
    const existing = ctx.db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as
      | GoalRow
      | undefined;
    if (!existing) throw new Error(`goal not found: ${id}`);
    ctx.db
      .prepare(
        `UPDATE goals SET
          title = ?, why_statement = ?, target_completion_date = ?, status = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        patch.title ?? existing.title,
        patch.whyStatement ?? existing.why_statement,
        patch.targetCompletionDate ?? existing.target_completion_date,
        patch.status ?? existing.status,
        Date.now(),
        id,
      );
    const row = ctx.db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalRow;
    await syncGoalsToMemory(ctx);
    return rowToGoal(row);
  },

  async archiveGoal(ctx: TenantContext, id: string): Promise<void> {
    ctx.db
      .prepare("UPDATE goals SET status='archived', updated_at=? WHERE id=?")
      .run(Date.now(), id);
    await syncGoalsToMemory(ctx);
  },

  async addMilestone(
    ctx: TenantContext,
    goalId: string,
    input: CreateMilestoneInput,
  ): Promise<Milestone> {
    const id = nanoid(12);
    const maxOrder = (ctx.db
      .prepare('SELECT COALESCE(MAX(display_order),-1) AS m FROM milestones WHERE goal_id=?')
      .get(goalId) as { m: number }).m;
    ctx.db
      .prepare(
        `INSERT INTO milestones
         (id,goal_id,title,target_week_index,display_order,status,completed_at,created_at)
         VALUES (?,?,?,?,?, 'pending', NULL, ?)`,
      )
      .run(id, goalId, input.title, input.targetWeekIndex ?? null, maxOrder + 1, Date.now());
    const row = ctx.db.prepare('SELECT * FROM milestones WHERE id=?').get(id) as MilestoneRow;
    await syncGoalsToMemory(ctx);
    return rowToMilestone(row);
  },

  async completeMilestone(ctx: TenantContext, id: string): Promise<void> {
    ctx.db
      .prepare("UPDATE milestones SET status='done', completed_at=? WHERE id=?")
      .run(Date.now(), id);
    await syncGoalsToMemory(ctx);
  },

  async addAction(
    ctx: TenantContext,
    milestoneId: string,
    input: CreateActionInput,
  ): Promise<Action> {
    const id = nanoid(12);
    ctx.db
      .prepare(
        `INSERT INTO actions
         (id,milestone_id,title,week_of,status,completed_at,created_at)
         VALUES (?,?,?,?, 'pending', NULL, ?)`,
      )
      .run(id, milestoneId, input.title, input.weekOf, Date.now());
    const row = ctx.db.prepare('SELECT * FROM actions WHERE id=?').get(id) as ActionRow;
    await syncGoalsToMemory(ctx);
    return rowToAction(row);
  },

  async markActionDone(ctx: TenantContext, id: string): Promise<void> {
    ctx.db
      .prepare("UPDATE actions SET status='done', completed_at=? WHERE id=?")
      .run(Date.now(), id);
    await syncGoalsToMemory(ctx);
  },

  async markActionSkipped(ctx: TenantContext, id: string): Promise<void> {
    ctx.db.prepare("UPDATE actions SET status='skipped' WHERE id=?").run(id);
    await syncGoalsToMemory(ctx);
  },

  async bindIntention(
    ctx: TenantContext,
    actionId: string,
    input: CreateIIInput,
  ): Promise<ImplementationIntention> {
    ctx.db
      .prepare(
        "UPDATE implementation_intentions SET status='retired', retired_at=? WHERE action_id=? AND status='active'",
      )
      .run(Date.now(), actionId);
    const id = nanoid(12);
    ctx.db
      .prepare(
        `INSERT INTO implementation_intentions
         (id,action_id,trigger,behavior,termination,fallback,status,success_count,fail_count,created_at)
         VALUES (?,?,?,?,?,?, 'active', 0, 0, ?)`,
      )
      .run(
        id,
        actionId,
        input.trigger,
        input.behavior,
        input.termination,
        input.fallback ?? null,
        Date.now(),
      );
    const row = ctx.db
      .prepare('SELECT * FROM implementation_intentions WHERE id=?')
      .get(id) as IIRow;
    return rowToII(row);
  },

  async listActiveGoals(ctx: TenantContext): Promise<GoalWithTree[]> {
    const goals = ctx.db
      .prepare("SELECT * FROM goals WHERE status='active' ORDER BY display_order")
      .all() as GoalRow[];
    return goals.map((g) => hydrateGoal(ctx, g));
  },

  async activeSnapshot(ctx: TenantContext): Promise<GoalSnapshot[]> {
    const goals = ctx.db
      .prepare("SELECT * FROM goals WHERE status='active' ORDER BY display_order")
      .all() as GoalRow[];
    return goals.map((g) => snapshot(ctx, g));
  },

  async getGoal(ctx: TenantContext, id: string): Promise<GoalWithTree | null> {
    const g = ctx.db.prepare('SELECT * FROM goals WHERE id=?').get(id) as GoalRow | undefined;
    if (!g) return null;
    return hydrateGoal(ctx, g);
  },
};

function hydrateGoal(ctx: TenantContext, g: GoalRow): GoalWithTree {
  const milestones = ctx.db
    .prepare('SELECT * FROM milestones WHERE goal_id=? ORDER BY display_order')
    .all(g.id) as MilestoneRow[];
  return {
    ...rowToGoal(g),
    milestones: milestones.map((m) => {
      const actions = ctx.db
        .prepare('SELECT * FROM actions WHERE milestone_id=? ORDER BY week_of')
        .all(m.id) as ActionRow[];
      return {
        ...rowToMilestone(m),
        actions: actions.map((a) => {
          const ii = ctx.db
            .prepare(
              "SELECT * FROM implementation_intentions WHERE action_id=? AND status='active'",
            )
            .get(a.id) as IIRow | undefined;
          return {
            ...rowToAction(a),
            intention: ii ? rowToII(ii) : null,
          };
        }),
      };
    }),
  };
}

function snapshot(ctx: TenantContext, g: GoalRow): GoalSnapshot {
  const actions = ctx.db
    .prepare(
      `SELECT a.* FROM actions a
       JOIN milestones m ON m.id = a.milestone_id
       WHERE m.goal_id = ?`,
    )
    .all(g.id) as ActionRow[];
  const percent = percentComplete(actions.map(rowToAction));
  const derivedStatus = deriveStatus(actions.map(rowToAction), percent);
  const currentMilestone = (ctx.db
    .prepare(
      "SELECT title FROM milestones WHERE goal_id=? AND status IN ('in_progress','pending') ORDER BY display_order LIMIT 1",
    )
    .get(g.id) as { title: string } | undefined)?.title ?? null;
  return {
    id: g.id,
    title: g.title,
    percent,
    derivedStatus,
    currentMilestone,
    updatedAt: g.updated_at,
  };
}

async function syncGoalsToMemory(ctx: TenantContext): Promise<void> {
  const snapshots = await goalTree.activeSnapshot(ctx);
  await memoryStore.syncGoalsSnapshot(ctx, snapshots);
}
