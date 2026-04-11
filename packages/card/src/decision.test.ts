import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTenantRegistry, type TenantRegistry } from '@levelup/tenancy';
import { goalTree } from '@levelup/goal-tree';
import { decideCard } from './decision.js';

describe('decideCard', () => {
  let dataRoot: string;
  let registry: TenantRegistry;

  beforeEach(async () => {
    dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'card-test-'));
    registry = createTenantRegistry({ dataRoot });
  });

  afterEach(async () => {
    await registry.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it('returns null with no active goals', async () => {
    const ctx = await registry.provision('user-lima1234');
    const card = await decideCard(ctx, {
      userMessage: 'finished it',
      intent: 'progress_report',
    });
    expect(card).toBeNull();
  });

  it('returns a progress card for progress_report intent', async () => {
    const ctx = await registry.provision('user-mike1234');
    const g = await goalTree.createGoal(ctx, { title: 'Side Project MVP' });
    await goalTree.addMilestone(ctx, g.id, { title: 'MVP doc' });

    const card = await decideCard(ctx, {
      userMessage: 'I finished the scope section',
      intent: 'progress_report',
    });
    expect(card?.type).toBe('progress');
    if (card?.type === 'progress') {
      expect(card.title).toBe('Side Project MVP');
    }
  });

  it('respects the 3-message gap', async () => {
    const ctx = await registry.provision('user-novem123');
    await goalTree.createGoal(ctx, { title: 'x' });
    const card = await decideCard(ctx, {
      userMessage: 'done',
      intent: 'progress_report',
      messagesSinceLastCard: 1,
    });
    expect(card).toBeNull();
  });

  it('returns a summary card for retro_request', async () => {
    const ctx = await registry.provision('user-oscar123');
    await goalTree.createGoal(ctx, { title: 'a' });
    await goalTree.createGoal(ctx, { title: 'b' });
    const card = await decideCard(ctx, {
      userMessage: 'complete a retro',
      intent: 'retro_request',
    });
    expect(card?.type).toBe('summary');
  });
});
