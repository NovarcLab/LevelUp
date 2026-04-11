import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { goalTree } from '@levelup/goal-tree';
import { requireTenant } from '../plugins.js';

export async function goalsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/goals', async (req) => {
    const tenant = requireTenant(req);
    const goals = await goalTree.listActiveGoals(tenant);
    return { goals };
  });

  app.get('/api/goals/snapshot', async (req) => {
    const tenant = requireTenant(req);
    return { goals: await goalTree.activeSnapshot(tenant) };
  });

  app.post('/api/goals', async (req) => {
    const tenant = requireTenant(req);
    const body = z
      .object({
        title: z.string().min(1),
        whyStatement: z.string().optional(),
        targetCompletionDate: z.number().int().optional(),
      })
      .parse(req.body);
    return goalTree.createGoal(tenant, body);
  });

  app.post('/api/goals/:goalId/milestones', async (req) => {
    const tenant = requireTenant(req);
    const { goalId } = z.object({ goalId: z.string() }).parse(req.params);
    const body = z
      .object({ title: z.string().min(1), targetWeekIndex: z.number().int().optional() })
      .parse(req.body);
    return goalTree.addMilestone(tenant, goalId, body);
  });

  app.post('/api/milestones/:milestoneId/actions', async (req) => {
    const tenant = requireTenant(req);
    const { milestoneId } = z.object({ milestoneId: z.string() }).parse(req.params);
    const body = z
      .object({ title: z.string().min(1), weekOf: z.string().min(1) })
      .parse(req.body);
    return goalTree.addAction(tenant, milestoneId, body);
  });

  app.post('/api/actions/:actionId/done', async (req) => {
    const tenant = requireTenant(req);
    const { actionId } = z.object({ actionId: z.string() }).parse(req.params);
    await goalTree.markActionDone(tenant, actionId);
    return { ok: true };
  });

  app.post('/api/actions/:actionId/intention', async (req) => {
    const tenant = requireTenant(req);
    const { actionId } = z.object({ actionId: z.string() }).parse(req.params);
    const body = z
      .object({
        trigger: z.string().min(1),
        behavior: z.string().min(1),
        termination: z.string().min(1),
        fallback: z.string().optional(),
      })
      .parse(req.body);
    return goalTree.bindIntention(tenant, actionId, body);
  });
}
