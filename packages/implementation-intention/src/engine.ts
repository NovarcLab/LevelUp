import type { TenantContext } from '@levelup/tenancy';
import type { LLMClient } from '@levelup/llm';
import { emit } from '@levelup/shared';
import { validateII, rewriteII, type IIDraft } from './validate.js';

export interface II {
  id: string;
  actionId: string;
  trigger: string;
  behavior: string;
  termination: string;
  fallback: string | null;
  status: 'active' | 'retired';
  successCount: number;
  failCount: number;
  createdAt: number;
  retiredAt: number | null;
}

interface IIRow {
  id: string;
  action_id: string;
  trigger: string;
  behavior: string;
  termination: string;
  fallback: string | null;
  status: string;
  success_count: number;
  fail_count: number;
  created_at: number;
  retired_at: number | null;
}

function rowToII(row: IIRow): II {
  return {
    id: row.id,
    actionId: row.action_id,
    trigger: row.trigger,
    behavior: row.behavior,
    termination: row.termination,
    fallback: row.fallback,
    status: row.status as 'active' | 'retired',
    successCount: row.success_count,
    failCount: row.fail_count,
    createdAt: row.created_at,
    retiredAt: row.retired_at,
  };
}

export function createIIEngine(llm: LLMClient) {
  return {
    /**
     * Generate a new implementation intention for an action.
     * Validates and retries up to 2 times.
     */
    async generate(ctx: TenantContext, actionId: string): Promise<II> {
      // Get action title for context
      const action = ctx.db
        .prepare('SELECT title FROM actions WHERE id = ?')
        .get(actionId) as { title: string } | undefined;
      if (!action) throw new Error(`Action ${actionId} not found`);

      const prompt = `Create an implementation intention for this action: "${action.title}"

Respond in JSON: {"trigger":"When ...","behavior":"I will ...","termination":"Until ...","fallback":"If not, then ..."}`;

      let response = '';
      for await (const ev of llm.stream({
        systemPrompt: 'Generate implementation intentions. Respond only in JSON.',
        messages: [{ role: 'user', content: prompt }],
      })) {
        if (ev.type === 'token') response += ev.text;
      }

      let draft: IIDraft;
      try {
        draft = JSON.parse(response) as IIDraft;
      } catch {
        draft = {
          trigger: `When I sit at my desk`,
          behavior: `Open the document for "${action.title}"`,
          termination: 'Until 25 minutes pass',
        };
      }

      // Validate + rewrite loop (max 2 attempts)
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await validateII(draft, llm);
        if (result.ok) break;
        draft = await rewriteII(draft, result.issues, llm);
      }

      // Retire any existing active II for this action
      ctx.db
        .prepare(
          `UPDATE implementation_intentions SET status='retired', retired_at=?
           WHERE action_id=? AND status='active'`,
        )
        .run(Date.now(), actionId);

      // Insert new II
      const { nanoid } = await import('nanoid');
      const id = nanoid(12);
      const now = Date.now();
      ctx.db
        .prepare(
          `INSERT INTO implementation_intentions
           (id,action_id,trigger,behavior,termination,fallback,status,success_count,fail_count,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(id, actionId, draft.trigger, draft.behavior, draft.termination, draft.fallback ?? null, 'active', 0, 0, now);

      return {
        id,
        actionId,
        trigger: draft.trigger,
        behavior: draft.behavior,
        termination: draft.termination,
        fallback: draft.fallback ?? null,
        status: 'active',
        successCount: 0,
        failCount: 0,
        createdAt: now,
        retiredAt: null,
      };
    },

    async replace(ctx: TenantContext, actionId: string, draft: IIDraft): Promise<II> {
      const result = await validateII(draft, llm);
      if (!result.ok) {
        const rewritten = await rewriteII(draft, result.issues, llm);
        return this.replace(ctx, actionId, rewritten);
      }

      ctx.db
        .prepare(
          `UPDATE implementation_intentions SET status='retired', retired_at=?
           WHERE action_id=? AND status='active'`,
        )
        .run(Date.now(), actionId);

      const { nanoid } = await import('nanoid');
      const id = nanoid(12);
      const now = Date.now();
      ctx.db
        .prepare(
          `INSERT INTO implementation_intentions
           (id,action_id,trigger,behavior,termination,fallback,status,success_count,fail_count,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(id, actionId, draft.trigger, draft.behavior, draft.termination, draft.fallback ?? null, 'active', 0, 0, now);

      return {
        id, actionId,
        trigger: draft.trigger, behavior: draft.behavior,
        termination: draft.termination, fallback: draft.fallback ?? null,
        status: 'active', successCount: 0, failCount: 0,
        createdAt: now, retiredAt: null,
      };
    },

    async recordSuccess(ctx: TenantContext, iiId: string): Promise<void> {
      ctx.db
        .prepare('UPDATE implementation_intentions SET success_count = success_count + 1 WHERE id = ?')
        .run(iiId);
    },

    async recordFail(ctx: TenantContext, iiId: string): Promise<void> {
      ctx.db
        .prepare('UPDATE implementation_intentions SET fail_count = fail_count + 1 WHERE id = ?')
        .run(iiId);

      const row = ctx.db
        .prepare('SELECT action_id, fail_count FROM implementation_intentions WHERE id = ?')
        .get(iiId) as { action_id: string; fail_count: number } | undefined;

      if (row && row.fail_count >= 3) {
        emit('intention.failed', {
          userId: ctx.tenantId,
          intentionId: iiId,
          failCount: row.fail_count,
        });
      }
    },

    async retireIfStale(ctx: TenantContext, iiId: string): Promise<boolean> {
      const row = ctx.db
        .prepare('SELECT fail_count, status FROM implementation_intentions WHERE id = ?')
        .get(iiId) as IIRow | undefined;
      if (!row || row.status === 'retired') return false;
      if (row.fail_count >= 3) {
        ctx.db
          .prepare('UPDATE implementation_intentions SET status=?, retired_at=? WHERE id=?')
          .run('retired', Date.now(), iiId);
        return true;
      }
      return false;
    },

    listHistory(ctx: TenantContext, actionId: string): II[] {
      const rows = ctx.db
        .prepare(
          'SELECT * FROM implementation_intentions WHERE action_id = ? ORDER BY created_at DESC',
        )
        .all(actionId) as IIRow[];
      return rows.map(rowToII);
    },

    getActive(ctx: TenantContext, actionId: string): II | null {
      const row = ctx.db
        .prepare(
          "SELECT * FROM implementation_intentions WHERE action_id = ? AND status = 'active'",
        )
        .get(actionId) as IIRow | undefined;
      return row ? rowToII(row) : null;
    },
  };
}
