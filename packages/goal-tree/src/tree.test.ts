import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTenantRegistry, type TenantRegistry } from '@levelup/tenancy';
import { goalTree } from './tree.js';
import { deriveStatus, percentComplete } from './derived.js';

describe('goalTree', () => {
  let dataRoot: string;
  let registry: TenantRegistry;

  beforeEach(async () => {
    dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'goaltree-test-'));
    registry = createTenantRegistry({ dataRoot });
  });

  afterEach(async () => {
    await registry.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it('creates a full goal tree and snapshots it', async () => {
    const ctx = await registry.provision('user-golf1234');
    const goal = await goalTree.createGoal(ctx, {
      title: 'Side Project MVP',
      whyStatement: 'Choose what I work on',
    });
    const m1 = await goalTree.addMilestone(ctx, goal.id, { title: 'Scope doc' });
    const m2 = await goalTree.addMilestone(ctx, goal.id, { title: 'MVP doc' });
    const a1 = await goalTree.addAction(ctx, m1.id, {
      title: 'Draft problem',
      weekOf: '2026-W14',
    });
    const a2 = await goalTree.addAction(ctx, m2.id, {
      title: 'Write stories',
      weekOf: '2026-W15',
    });

    await goalTree.markActionDone(ctx, a1.id);
    await goalTree.bindIntention(ctx, a2.id, {
      trigger: 'It is 9pm and I sit at the desk',
      behavior: 'Open the doc, write the scope section',
      termination: 'A 25 minute timer ends',
    });

    const snapshots = await goalTree.activeSnapshot(ctx);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.percent).toBe(50);
    expect(snapshots[0]?.derivedStatus).toBe('active');

    const tree = await goalTree.getGoal(ctx, goal.id);
    expect(tree?.milestones).toHaveLength(2);
    expect(tree?.milestones[1]?.actions[0]?.intention?.trigger).toContain('9pm');
  });

  it('writes GOALS.md after every mutation', async () => {
    const ctx = await registry.provision('user-hotel123');
    await goalTree.createGoal(ctx, { title: 'Daily writing' });
    const raw = await ctx.workspace.readText('GOALS.md');
    expect(raw).toContain('Daily writing');
  });

  it('deriveStatus returns near-done at 80%', () => {
    expect(deriveStatus([], 85)).toBe('near-done');
  });

  it('deriveStatus returns stuck when idle >14 days', () => {
    const now = Date.now();
    const actions = [
      {
        id: 'a1',
        milestoneId: 'm',
        title: 't',
        weekOf: 'W1',
        status: 'done' as const,
        completedAt: now - 20 * 86_400_000,
      },
    ];
    expect(deriveStatus(actions, 10, now)).toBe('stuck');
  });

  it('percentComplete counts only done', () => {
    const actions = [
      { id: 'a', milestoneId: 'm', title: 't', weekOf: 'W', status: 'done' as const, completedAt: 1 },
      { id: 'b', milestoneId: 'm', title: 't', weekOf: 'W', status: 'pending' as const, completedAt: null },
      { id: 'c', milestoneId: 'm', title: 't', weekOf: 'W', status: 'done' as const, completedAt: 2 },
    ];
    expect(percentComplete(actions)).toBe(67);
  });
});
