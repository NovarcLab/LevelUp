import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { memoryStore } from '@levelup/memory';
import { personaEngine } from '@levelup/persona';
import { requireTenant, requireUser } from '../plugins.js';
import type { Auth } from '../auth.js';

export async function settingsRoutes(
  app: FastifyInstance,
  deps: { auth: Auth },
): Promise<void> {
  // Profile
  app.get('/api/settings/profile', async (req) => {
    const tenant = requireTenant(req);
    const profile = await memoryStore.readProfile(tenant);
    return { profile };
  });

  app.patch('/api/settings/profile', async (req) => {
    const tenant = requireTenant(req);
    const body = z
      .object({
        name: z.string().optional(),
        city: z.string().optional(),
        role: z.string().optional(),
      })
      .parse(req.body);
    await memoryStore.patchProfile(tenant, body);
    return { ok: true };
  });

  // Persona dimensions
  app.get('/api/settings/persona', async (req) => {
    const tenant = requireTenant(req);
    const persona = await personaEngine.readPersona(tenant);
    return { persona };
  });

  app.patch('/api/settings/persona', async (req) => {
    const tenant = requireTenant(req);
    const body = z
      .object({
        warmth: z.number().min(0).max(100).optional(),
        directness: z.number().min(0).max(100).optional(),
        pacing: z.number().min(0).max(100).optional(),
      })
      .parse(req.body);
    await personaEngine.calibrate(tenant, {
      type: 'manual_adjustment',
      ...body,
    });
    return { ok: true };
  });

  // Memory (What I Remember)
  app.get('/api/settings/memory', async (req) => {
    const tenant = requireTenant(req);
    const digests = await memoryStore.readRecentDigests(tenant, 20);
    return { digests };
  });

  app.delete('/api/settings/memory/:segmentId', async (req) => {
    const tenant = requireTenant(req);
    const { segmentId } = z.object({ segmentId: z.string() }).parse(req.params);
    await memoryStore.forgetDigest(tenant, segmentId);
    return { ok: true };
  });

  // MCP Tokens (re-exposes from mcp routes for settings UI)
  app.get('/api/settings/mcp-tokens', async (req) => {
    const user = requireUser(req);
    return { tokens: deps.auth.listMcpTokens(user.id) };
  });

  // Data export
  app.get('/api/settings/export', async (req) => {
    const tenant = requireTenant(req);
    const profile = await memoryStore.readProfile(tenant);
    const digests = await memoryStore.readRecentDigests(tenant, 1000);
    const goals = tenant.db.prepare('SELECT * FROM goals').all();
    const conversations = tenant.db.prepare('SELECT * FROM conversations ORDER BY last_msg_at DESC').all();
    return { profile, digests, goals, conversations };
  });

  // Account deletion
  app.delete('/api/settings/account', async (req) => {
    const user = requireUser(req);
    const tenant = requireTenant(req);

    // Soft delete: mark user as deleted
    // The cleanup cron will physically deprovision after 30 days
    const systemDb = (deps.auth as { systemDb?: unknown }).systemDb;
    // Use requireUser's session to get system db access
    // For now, mark in tenant workspace
    await tenant.workspace.writeTextAtomic('DELETED', new Date().toISOString());

    return { ok: true, message: 'Account marked for deletion. Data will be removed in 30 days.' };
  });
}
