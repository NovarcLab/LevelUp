import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTenantRegistry, type TenantRegistry } from '@levelup/tenancy';
import { personaEngine } from '@levelup/persona';
import { memoryStore } from '@levelup/memory';
import { goalTree } from '@levelup/goal-tree';
import { buildContext } from './build.js';
import { classifyIntent } from './intent.js';

describe('classifyIntent', () => {
  it('detects common intents from user messages', () => {
    expect(classifyIntent('I finished the PRD')).toBe('progress_report');
    expect(classifyIntent('我写完了')).toBe('progress_report');
    expect(classifyIntent('累了，不想动')).toBe('emotion');
    expect(classifyIntent('I want to start a new goal')).toBe('new_goal');
    expect(classifyIntent('复盘一下这周')).toBe('retro_request');
    expect(classifyIntent('what should i do next')).toBe('goal_query');
    expect(classifyIntent('just a random chat')).toBe('small_talk');
  });
});

describe('buildContext', () => {
  let dataRoot: string;
  let registry: TenantRegistry;

  beforeEach(async () => {
    dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'context-test-'));
    registry = createTenantRegistry({ dataRoot });
  });

  afterEach(async () => {
    await registry.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it('assembles system prompt + always-keep segments', async () => {
    const ctx = await registry.provision('user-india1234');
    await personaEngine.initSoul(ctx);
    await memoryStore.initProfile(ctx, { name: 'Ling' });
    await memoryStore.patchProfile(ctx, { city: 'Shanghai', role: 'PM' });
    await goalTree.createGoal(ctx, { title: 'Side Project MVP' });

    const packet = await buildContext(ctx, {
      conversationId: 'conv-1',
      userMessage: 'I finished the scope section',
    });

    expect(packet.meta.intent).toBe('progress_report');
    expect(packet.meta.includedSegments).toContain('system');
    expect(packet.meta.includedSegments).toContain('user_msg');
    expect(packet.meta.includedSegments).toContain('profile');
    expect(packet.systemPrompt).toContain('Profile');
    expect(packet.systemPrompt).toContain('Side Project MVP');
    expect(packet.messages.at(-1)?.content).toBe('I finished the scope section');
  });

  it('truncates under a tight budget and drops highest-level segments first', async () => {
    const ctx = await registry.provision('user-juliet12');
    await personaEngine.initSoul(ctx);
    await memoryStore.initProfile(ctx, { name: 'Ling' });
    await goalTree.createGoal(ctx, { title: 'A' });
    await memoryStore.writeTrend(ctx, '2026-W15', {
      isoWeek: '2026-W15',
      executionPattern: 'x'.repeat(500),
      mostEffectiveTrigger: 'y'.repeat(500),
      mostMissedDay: 'Wed',
      emotionalArc: 'steady',
      recurringBlockers: [],
    });

    const packet = await buildContext(ctx, {
      conversationId: 'c',
      userMessage: 'hello',
      budgetTokens: 400,
    });

    expect(packet.meta.droppedSegments.length).toBeGreaterThan(0);
    expect(packet.meta.includedSegments).toContain('system');
    expect(packet.meta.includedSegments).toContain('user_msg');
  });

  it('respects openingHint in the system prompt', async () => {
    const ctx = await registry.provision('user-kilo1234');
    await personaEngine.initSoul(ctx);
    await memoryStore.initProfile(ctx, { name: 'Ling' });
    const packet = await buildContext(ctx, {
      conversationId: 'c',
      userMessage: 'hi',
      openingHint: 'reconnect',
    });
    expect(packet.systemPrompt).toMatch(/unhurried|reconnect|over a week/i);
  });
});
