import type { TenantContext } from '@levelup/tenancy';
import {
  ProfileSchema,
  SessionDigestSchema,
  TrendReportSchema,
  type Profile,
  type SessionDigest,
  type TrendReport,
  type GoalSnapshot,
} from '@levelup/shared';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.js';

const PROFILE_PATH = 'PROFILE.md';
const GOALS_PATH = 'GOALS.md';
const MEMORY_PATH = 'MEMORY.md';

function digestPath(date: string): string {
  return `digests/${date}.md`;
}

function trendPath(isoWeek: string): string {
  return `trends/week-${isoWeek}.md`;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The file-system memory store. All methods take a TenantContext and operate
 * exclusively within ctx.workspace — memory has no global state and cannot
 * reach across tenants.
 */
export const memoryStore = {
  /** Write the baseline PROFILE.md after provisioning. Idempotent. */
  async initProfile(ctx: TenantContext, seed: { name: string }): Promise<void> {
    const existing = await ctx.workspace.readTextOrNull(PROFILE_PATH);
    if (existing) return;
    const profile: Profile = {
      name: seed.name,
      values: [],
      relationships: [],
      updatedAt: new Date().toISOString(),
      about: '',
    };
    await writeProfile(ctx, profile);

    const memoryMd =
      `# ${seed.name} · long-term memory\n\n` +
      `## Who they are\n- [profile](PROFILE.md)\n\n` +
      `## What they're doing\n- [goals](GOALS.md)\n\n` +
      `## How I speak to them\n- [soul](SOUL.md)\n`;
    await ctx.workspace.writeTextAtomic(MEMORY_PATH, memoryMd);
  },

  async readProfile(ctx: TenantContext): Promise<Profile> {
    const raw = await ctx.workspace.readText(PROFILE_PATH);
    const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(raw, {});
    const merged = { ...frontmatter, about: body.trim() };
    return ProfileSchema.parse(merged);
  },

  async patchProfile(ctx: TenantContext, patch: Partial<Profile>): Promise<Profile> {
    const current = await memoryStore.readProfile(ctx);
    const next: Profile = ProfileSchema.parse({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await writeProfile(ctx, next);
    return next;
  },

  async syncGoalsSnapshot(
    ctx: TenantContext,
    snapshots: GoalSnapshot[],
    nowIso = new Date().toISOString(),
  ): Promise<void> {
    const lines: string[] = [];
    lines.push(`# Goals`);
    lines.push('');
    lines.push(`_Last synced: ${nowIso}_`);
    lines.push('');
    const active = snapshots.filter((g) => g.derivedStatus !== 'near-done' || g.percent < 100);
    if (active.length === 0) {
      lines.push('## Active');
      lines.push('');
      lines.push('_None right now._');
    } else {
      lines.push('## Active');
      lines.push('');
      for (const g of snapshots) {
        lines.push(`### ${g.title} · ${g.percent}%`);
        if (g.currentMilestone) lines.push(`> Current: ${g.currentMilestone}`);
        lines.push(`> Status: ${g.derivedStatus}`);
        lines.push('');
      }
    }
    await ctx.workspace.writeTextAtomic(GOALS_PATH, lines.join('\n'));
  },

  async readGoalsSnapshot(ctx: TenantContext): Promise<string> {
    return (await ctx.workspace.readTextOrNull(GOALS_PATH)) ?? '';
  },

  async appendDigest(ctx: TenantContext, digest: SessionDigest): Promise<void> {
    const parsed = SessionDigestSchema.parse(digest);
    const date = parsed.startedAt.slice(0, 10) || todayUtc();
    const rel = digestPath(date);
    const existing = (await ctx.workspace.readTextOrNull(rel)) ?? `# ${date}\n`;
    const block = renderDigest(parsed);
    const next = existing.endsWith('\n') ? existing + block : `${existing}\n${block}`;
    await ctx.workspace.writeTextAtomic(rel, next);
  },

  async readRecentDigests(ctx: TenantContext, n: number): Promise<SessionDigest[]> {
    const files = (await ctx.workspace.listDir('digests'))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse();
    const out: SessionDigest[] = [];
    for (const file of files) {
      if (out.length >= n) break;
      const raw = await ctx.workspace.readText(`digests/${file}`);
      const digests = parseDigestFile(raw);
      for (const d of digests.reverse()) {
        if (out.length >= n) break;
        if (!d.deleted) out.push(d);
      }
    }
    return out;
  },

  async searchDigests(
    ctx: TenantContext,
    _query: string,
    k: number,
  ): Promise<SessionDigest[]> {
    // MVP: fall back to recent-by-importance until vector store is wired.
    const recent = await memoryStore.readRecentDigests(ctx, k * 3);
    return recent
      .sort((a, b) => b.importance - a.importance)
      .slice(0, k);
  },

  async forgetDigest(ctx: TenantContext, segmentId: string): Promise<void> {
    const files = (await ctx.workspace.listDir('digests')).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const rel = `digests/${file}`;
      const raw = await ctx.workspace.readText(rel);
      if (!raw.includes(segmentId)) continue;
      const digests = parseDigestFile(raw);
      let changed = false;
      for (const d of digests) {
        if (d.segmentId === segmentId && !d.deleted) {
          d.deleted = true;
          changed = true;
        }
      }
      if (changed) {
        const header = raw.split('\n')[0] ?? `# ${file.slice(0, 10)}`;
        const rebuilt = [header, '', ...digests.map(renderDigest)].join('\n');
        await ctx.workspace.writeTextAtomic(rel, rebuilt);
        try {
          ctx.vectors.remove(segmentId);
        } catch {
          /* vectors may be no-op */
        }
      }
    }
  },

  async writeTrend(
    ctx: TenantContext,
    isoWeek: string,
    trend: TrendReport,
  ): Promise<void> {
    const parsed = TrendReportSchema.parse({ ...trend, isoWeek });
    const body = [
      `# Week ${parsed.isoWeek}`,
      '',
      `- Execution: ${parsed.executionPattern}`,
      `- Most effective trigger: ${parsed.mostEffectiveTrigger}`,
      `- Most missed day: ${parsed.mostMissedDay}`,
      `- Emotional arc: ${parsed.emotionalArc}`,
      '',
      '## Recurring blockers',
      ...parsed.recurringBlockers.map((b) => `- ${b}`),
      '',
    ].join('\n');
    await ctx.workspace.writeTextAtomic(trendPath(isoWeek), body);
  },

  async readLatestTrend(ctx: TenantContext): Promise<TrendReport | null> {
    const files = (await ctx.workspace.listDir('trends'))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse();
    const latest = files[0];
    if (!latest) return null;
    const raw = await ctx.workspace.readText(`trends/${latest}`);
    return parseTrendFile(raw);
  },
};

async function writeProfile(ctx: TenantContext, profile: Profile): Promise<void> {
  const { about, ...frontmatter } = profile;
  const doc = stringifyFrontmatter({ frontmatter, body: about });
  await ctx.workspace.writeTextAtomic(PROFILE_PATH, doc);
}

function renderDigest(d: SessionDigest): string {
  const lines = [
    `## Session · ${d.startedAt} → ${d.endedAt}`,
    '',
    `- **About**: ${d.topic}`,
    `- **Progress**: ${d.progress}`,
    `- **Mood**: ${d.mood}`,
  ];
  if (d.openQuestions.length > 0) {
    lines.push(`- **Open**: ${d.openQuestions.join('; ')}`);
  }
  if (d.aiPromises.length > 0) {
    lines.push(`- **AI promised**: ${d.aiPromises.join('; ')}`);
  }
  lines.push('');
  lines.push(
    `<!-- segment:${d.segmentId} conv:${d.conversationId} importance:${d.importance}${d.deleted ? ' deleted:1' : ''} -->`,
  );
  lines.push('');
  return lines.join('\n');
}

/**
 * A forgiving parser that pulls structured fields back out of the rendered
 * markdown. It reads the HTML comment sentinel for metadata and the bullet
 * list for human fields.
 */
function parseDigestFile(raw: string): SessionDigest[] {
  const segments = raw.split(/^## Session /m).slice(1);
  const out: SessionDigest[] = [];
  for (const seg of segments) {
    const header = seg.split('\n', 1)[0] ?? '';
    const [startedAt, endedAt] = header.split('→').map((s) => s.trim().replace(/^·\s*/, ''));
    const meta = /<!--\s*segment:(\S+)\s+conv:(\S+)\s+importance:(\d+)(?:\s+deleted:1)?\s*-->/.exec(
      seg,
    );
    if (!meta || !startedAt || !endedAt) continue;
    const deleted = /deleted:1/.test(meta[0]);
    const topic = pickBullet(seg, 'About') ?? '';
    const progress = pickBullet(seg, 'Progress') ?? '';
    const moodRaw = pickBullet(seg, 'Mood') ?? 'mid';
    const mood = (['low', 'mid', 'high', 'mixed'] as const).includes(moodRaw as never)
      ? (moodRaw as SessionDigest['mood'])
      : 'mid';
    const open = pickBullet(seg, 'Open');
    const ai = pickBullet(seg, 'AI promised');
    out.push(
      SessionDigestSchema.parse({
        segmentId: meta[1],
        conversationId: meta[2],
        startedAt,
        endedAt,
        topic,
        progress,
        mood,
        openQuestions: open ? open.split(';').map((s) => s.trim()).filter(Boolean) : [],
        aiPromises: ai ? ai.split(';').map((s) => s.trim()).filter(Boolean) : [],
        importance: Number(meta[3]),
        deleted,
      }),
    );
  }
  return out;
}

function pickBullet(block: string, label: string): string | null {
  const m = new RegExp(`^-\\s+\\*\\*${label}\\*\\*:\\s*(.+)$`, 'm').exec(block);
  return m ? (m[1] ?? '').trim() : null;
}

function parseTrendFile(raw: string): TrendReport {
  const isoWeek = /Week\s+(\S+)/.exec(raw)?.[1] ?? '';
  const pick = (label: string): string => {
    const m = new RegExp(`^- ${label}:\\s*(.+)$`, 'm').exec(raw);
    return m ? (m[1] ?? '').trim() : '';
  };
  const blockers: string[] = [];
  const blockerBlock = raw.split('## Recurring blockers')[1] ?? '';
  for (const line of blockerBlock.split('\n')) {
    const m = /^-\s+(.+)$/.exec(line);
    if (m) blockers.push((m[1] ?? '').trim());
  }
  return TrendReportSchema.parse({
    isoWeek,
    executionPattern: pick('Execution'),
    mostEffectiveTrigger: pick('Most effective trigger'),
    mostMissedDay: pick('Most missed day'),
    emotionalArc: pick('Emotional arc'),
    recurringBlockers: blockers,
  });
}
