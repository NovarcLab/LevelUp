import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTenantRegistry, type TenantRegistry } from '@levelup/tenancy';
import { personaEngine } from './engine.js';

describe('personaEngine', () => {
  let dataRoot: string;
  let registry: TenantRegistry;

  beforeEach(async () => {
    dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'persona-test-'));
    registry = createTenantRegistry({ dataRoot });
  });

  afterEach(async () => {
    await registry.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it('initSoul writes SOUL.md with baseline dimensions', async () => {
    const ctx = await registry.provision('user-alfa1234');
    const soul = await personaEngine.initSoul(ctx);
    expect(soul.frontmatter.warmth).toBe(60);
    expect(soul.frontmatter.directness).toBe(55);
    expect(soul.frontmatter.pacing).toBe(50);
    expect(await ctx.workspace.exists('SOUL.md')).toBe(true);
  });

  it('loadSoul returns the persisted dimensions', async () => {
    const ctx = await registry.provision('user-bravo234');
    await personaEngine.initSoul(ctx);
    const soul = await personaEngine.loadSoul(ctx);
    expect(soul.aboutMd).toContain('growth companion');
  });

  it('manualSet updates dimensions and clamps', async () => {
    const ctx = await registry.provision('user-chrly1234');
    await personaEngine.initSoul(ctx);
    const out = await personaEngine.manualSet(ctx, { warmth: 999 });
    expect(out.frontmatter.warmth).toBe(100);
  });

  it('calibrate responds to emotion signals and logs the reason', async () => {
    const ctx = await registry.provision('user-delta234');
    await personaEngine.initSoul(ctx);
    const out = await personaEngine.calibrate(ctx, {
      type: 'emotion_word',
      word: '累',
      intensity: 0.8,
    });
    expect(out.frontmatter.warmth).toBe(63);
    expect(out.frontmatter.pacing).toBe(55);
    expect(out.frontmatter.calibrationLog).toHaveLength(1);
  });

  it('calibrate clamps to [0, 100]', async () => {
    const ctx = await registry.provision('user-echo12345');
    await personaEngine.initSoul(ctx);
    // push warmth down below 0 with repeated pushback
    for (let i = 0; i < 20; i++) {
      await personaEngine.calibrate(ctx, { type: 'user_pushback', phrase: 'stop' });
    }
    const soul = await personaEngine.loadSoul(ctx);
    expect(soul.frontmatter.warmth).toBeGreaterThanOrEqual(0);
  });

  it('buildSystemPrompt contains hard boundaries and forbidden phrases', async () => {
    const ctx = await registry.provision('user-foxtrot1');
    const soul = await personaEngine.initSoul(ctx);
    const prompt = personaEngine.buildSystemPrompt(soul, { intent: 'emotion' });
    expect(prompt).toContain('Hard boundaries');
    expect(prompt).toContain('Forbidden openings');
    expect(prompt).toContain('太棒了');
    expect(prompt).toContain('emotion');
  });
});
