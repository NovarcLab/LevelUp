import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTenantRegistry, type TenantRegistry } from '@levelup/tenancy';
import { memoryStore } from './store.js';

describe('memoryStore', () => {
  let dataRoot: string;
  let registry: TenantRegistry;

  beforeEach(async () => {
    dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'memory-test-'));
    registry = createTenantRegistry({ dataRoot });
  });

  afterEach(async () => {
    await registry.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it('initProfile writes PROFILE.md and MEMORY.md', async () => {
    const ctx = await registry.provision('user-zulu1234');
    await memoryStore.initProfile(ctx, { name: 'Ling' });
    const profile = await memoryStore.readProfile(ctx);
    expect(profile.name).toBe('Ling');
    expect(await ctx.workspace.exists('MEMORY.md')).toBe(true);
  });

  it('patchProfile updates a field and preserves others', async () => {
    const ctx = await registry.provision('user-papa1234');
    await memoryStore.initProfile(ctx, { name: 'Ling' });
    const next = await memoryStore.patchProfile(ctx, { city: 'Shanghai', role: 'PM' });
    expect(next.city).toBe('Shanghai');
    expect(next.role).toBe('PM');
    expect(next.name).toBe('Ling');
  });

  it('appendDigest + readRecentDigests round-trips', async () => {
    const ctx = await registry.provision('user-romeo123');
    await memoryStore.appendDigest(ctx, {
      segmentId: 'seg-001',
      conversationId: 'conv-aaa',
      startedAt: '2026-04-11T20:14:00Z',
      endedAt: '2026-04-11T20:42:00Z',
      topic: 'Side project MVP',
      progress: 'Finished problem definition',
      mood: 'mid',
      openQuestions: ['Do I include competitor analysis?'],
      aiPromises: ['Ask about progress Thursday'],
      importance: 72,
      deleted: false,
    });
    await memoryStore.appendDigest(ctx, {
      segmentId: 'seg-002',
      conversationId: 'conv-aaa',
      startedAt: '2026-04-11T22:00:00Z',
      endedAt: '2026-04-11T22:15:00Z',
      topic: 'Daily writing',
      progress: '500 words, dialogue scene',
      mood: 'high',
      openQuestions: [],
      aiPromises: [],
      importance: 55,
      deleted: false,
    });

    const recent = await memoryStore.readRecentDigests(ctx, 5);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.segmentId).toBe('seg-002');
    expect(recent[1]?.openQuestions).toEqual(['Do I include competitor analysis?']);
  });

  it('forgetDigest marks a segment deleted and hides from recent', async () => {
    const ctx = await registry.provision('user-sierra12');
    await memoryStore.appendDigest(ctx, {
      segmentId: 'seg-forgettable',
      conversationId: 'conv-xyz',
      startedAt: '2026-04-10T10:00:00Z',
      endedAt: '2026-04-10T10:30:00Z',
      topic: 'Job change doubts',
      progress: 'talked it out',
      mood: 'low',
      openQuestions: [],
      aiPromises: [],
      importance: 60,
      deleted: false,
    });

    await memoryStore.forgetDigest(ctx, 'seg-forgettable');
    const recent = await memoryStore.readRecentDigests(ctx, 5);
    expect(recent.find((d) => d.segmentId === 'seg-forgettable')).toBeUndefined();
  });

  it('syncGoalsSnapshot writes a readable GOALS.md', async () => {
    const ctx = await registry.provision('user-tango123');
    await memoryStore.syncGoalsSnapshot(ctx, [
      {
        id: 'g1',
        title: 'Side Project MVP',
        percent: 58,
        derivedStatus: 'active',
        currentMilestone: 'Finish MVP document',
        updatedAt: Date.now(),
      },
    ]);
    const raw = await memoryStore.readGoalsSnapshot(ctx);
    expect(raw).toContain('Side Project MVP · 58%');
    expect(raw).toContain('Current: Finish MVP document');
  });

  it('writeTrend + readLatestTrend round-trips', async () => {
    const ctx = await registry.provision('user-victor123');
    await memoryStore.writeTrend(ctx, '2026-W15', {
      isoWeek: '2026-W15',
      executionPattern: 'strongest in the evenings',
      mostEffectiveTrigger: 'desk at 9pm',
      mostMissedDay: 'Wednesday',
      emotionalArc: 'steady with a dip midweek',
      recurringBlockers: ['meeting fatigue', 'ambiguous scope'],
    });
    const trend = await memoryStore.readLatestTrend(ctx);
    expect(trend?.mostEffectiveTrigger).toBe('desk at 9pm');
    expect(trend?.recurringBlockers).toEqual(['meeting fatigue', 'ambiguous scope']);
  });
});
