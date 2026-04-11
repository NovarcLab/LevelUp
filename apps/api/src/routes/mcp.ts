import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { goalTree } from '@levelup/goal-tree';
import { memoryStore } from '@levelup/memory';
import { ForbiddenError, UnauthorizedError } from '@levelup/shared';
import { requireTenant, requireUser } from '../plugins.js';
import type { Auth } from '../auth.js';

/**
 * The MCP server. Implemented as a single JSON-RPC-ish endpoint for
 * simplicity — one POST to `/mcp` routes to the appropriate tool handler.
 *
 * Tools are keyed by `method`, scopes are enforced up front, and every
 * invocation is appended to the tenant's own audit log. Business code is
 * reused unchanged: the MCP route and the web route both go through the
 * same goalTree/memoryStore modules on the same TenantContext.
 */
export async function mcpRoutes(
  app: FastifyInstance,
  deps: { auth: Auth },
): Promise<void> {
  // Settings: manage tokens
  app.post('/api/mcp/tokens', async (req) => {
    const user = requireUser(req);
    const body = z
      .object({
        name: z.string().min(1),
        scopes: z.array(z.string()).min(1),
      })
      .parse(req.body);
    const { id, token } = await deps.auth.createMcpToken(user.id, body.name, body.scopes);
    return { id, token, warning: 'Copy this token now. It will not be shown again.' };
  });

  app.get('/api/mcp/tokens', async (req) => {
    const user = requireUser(req);
    return { tokens: deps.auth.listMcpTokens(user.id) };
  });

  app.delete('/api/mcp/tokens/:id', async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    deps.auth.revokeMcpToken(user.id, id);
    return { ok: true };
  });

  // MCP JSON-RPC endpoint
  app.post('/mcp', async (req) => {
    const tenant = requireTenant(req);
    if (!req.mcpScopes) throw new UnauthorizedError('MCP token required');
    const scopes = new Set(req.mcpScopes);

    const body = z
      .object({
        method: z.string(),
        params: z.record(z.unknown()).optional(),
      })
      .parse(req.body);

    const ensure = (scope: string): void => {
      if (!scopes.has(scope)) throw new ForbiddenError(`scope required: ${scope}`);
    };

    const auditLine = {
      ts: Date.now(),
      method: body.method,
      params: body.params ?? {},
      ok: true,
    };

    try {
      switch (body.method) {
        case 'tools/list':
          return { tools: toolCatalog() };

        case 'list_active_goals': {
          ensure('goals:read');
          const goals = await goalTree.activeSnapshot(tenant);
          return { goals };
        }

        case 'get_goal': {
          ensure('goals:read');
          const { goalId } = z
            .object({ goalId: z.string() })
            .parse(body.params ?? {});
          return { goal: await goalTree.getGoal(tenant, goalId) };
        }

        case 'list_week_actions': {
          ensure('progress:read');
          const goals = await goalTree.listActiveGoals(tenant);
          const actions = goals.flatMap((g) =>
            g.milestones.flatMap((m) =>
              m.actions.map((a) => ({
                id: a.id,
                title: a.title,
                status: a.status,
                goalTitle: g.title,
                milestoneTitle: m.title,
                weekOf: a.weekOf,
              })),
            ),
          );
          return { actions };
        }

        case 'mark_action_done': {
          ensure('progress:write');
          const { actionId } = z
            .object({ actionId: z.string() })
            .parse(body.params ?? {});
          await goalTree.markActionDone(tenant, actionId);
          return { ok: true };
        }

        case 'get_recent_digests': {
          ensure('memory:read');
          const { limit } = z
            .object({ limit: z.number().int().min(1).max(50).default(7) })
            .parse(body.params ?? {});
          const digests = await memoryStore.readRecentDigests(tenant, limit);
          return { digests };
        }

        default:
          auditLine.ok = false;
          throw new Error(`unknown method: ${body.method}`);
      }
    } finally {
      // Best-effort append — any failure writing the audit log must not
      // obscure the actual response (especially errors).
      tenant.workspace
        .appendText('mcp-audit.jsonl', `${JSON.stringify(auditLine)}\n`)
        .catch(() => undefined);
    }
  });
}

function toolCatalog(): Array<{ name: string; scopes: string[]; description: string }> {
  return [
    {
      name: 'list_active_goals',
      scopes: ['goals:read'],
      description: "List the user's active goals with percent and derived status.",
    },
    {
      name: 'get_goal',
      scopes: ['goals:read'],
      description: 'Fetch one goal with its full milestone and action tree.',
    },
    {
      name: 'list_week_actions',
      scopes: ['progress:read'],
      description: 'List the actions scheduled for the current and near weeks.',
    },
    {
      name: 'mark_action_done',
      scopes: ['progress:write'],
      description: 'Mark an action as done.',
    },
    {
      name: 'get_recent_digests',
      scopes: ['memory:read'],
      description: 'Return recent session digests (summaries).',
    },
  ];
}
