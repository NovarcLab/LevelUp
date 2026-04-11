import type { TenantContext } from '@levelup/tenancy';
import type { Intent } from '@levelup/shared';
import type { ChatMessage } from '@levelup/llm';
import { personaEngine } from '@levelup/persona';
import { memoryStore } from '@levelup/memory';
import { goalTree } from '@levelup/goal-tree';
import { classifyIntent } from './intent.js';

export interface BuildInput {
  conversationId: string;
  userMessage: string;
  intent?: Intent;
  openingHint?: 'continue' | 'reopen' | 'reconnect' | 'new_user';
  recentMessages?: ChatMessage[];
  budgetTokens?: number;
}

export interface ContextPacket {
  systemPrompt: string;
  messages: ChatMessage[];
  meta: {
    tokenEstimate: number;
    budget: number;
    intent: Intent;
    includedSegments: string[];
    droppedSegments: string[];
    buildDurationMs: number;
  };
}

type SegmentId =
  | 'system'
  | 'user_msg'
  | 'recent_tail'
  | 'profile'
  | 'goals'
  | 'trend'
  | 'history_older'
  | 'digests';

interface Segment {
  id: SegmentId;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  text: string;
  tokens: number;
  mustKeep: boolean;
}

const DEFAULT_BUDGET = 2000;

/**
 * Assembles a ContextPacket under a token budget. Parallel-fetches every
 * source, then drops segments from highest `level` down until the total fits.
 * Level 0 and 1 segments are "mustKeep" — if they alone exceed the budget,
 * the oldest recent messages get trimmed.
 */
export async function buildContext(
  ctx: TenantContext,
  input: BuildInput,
): Promise<ContextPacket> {
  const started = Date.now();
  const budget = input.budgetTokens ?? DEFAULT_BUDGET;
  const intent = input.intent ?? classifyIntent(input.userMessage);
  const recent = input.recentMessages ?? [];

  const [soul, profile, goalsMd, digests, trend, snapshots] = await Promise.all([
    personaEngine.loadSoul(ctx),
    memoryStore.readProfile(ctx).catch(() => null),
    memoryStore.readGoalsSnapshot(ctx),
    memoryStore.searchDigests(ctx, input.userMessage, 3).catch(() => []),
    memoryStore.readLatestTrend(ctx).catch(() => null),
    goalTree.activeSnapshot(ctx).catch(() => []),
  ]);

  const systemPrompt = personaEngine.buildSystemPrompt(soul, {
    intent,
    ...(input.openingHint !== undefined ? { openingHint: input.openingHint } : {}),
  });

  const segments: Segment[] = [];

  segments.push({
    id: 'system',
    level: 0,
    text: systemPrompt,
    tokens: estimateTokens(systemPrompt),
    mustKeep: true,
  });
  segments.push({
    id: 'user_msg',
    level: 0,
    text: input.userMessage,
    tokens: estimateTokens(input.userMessage),
    mustKeep: true,
  });

  const tailCount = Math.min(3, recent.length);
  const tail = recent.slice(-tailCount);
  const tailText = tail.map((m) => `${m.role}: ${m.content}`).join('\n');
  segments.push({
    id: 'recent_tail',
    level: 0,
    text: tailText,
    tokens: estimateTokens(tailText),
    mustKeep: true,
  });

  if (profile) {
    const profileText = renderProfile(profile);
    segments.push({
      id: 'profile',
      level: 1,
      text: profileText,
      tokens: estimateTokens(profileText),
      mustKeep: true,
    });
  }

  if (snapshots.length > 0 || goalsMd) {
    const goalsText = goalsMd
      ? goalsMd
      : snapshots
          .map((g) => `- ${g.title} · ${g.percent}% · ${g.derivedStatus}`)
          .join('\n');
    segments.push({
      id: 'goals',
      level: levelForIntent('goals', intent),
      text: goalsText,
      tokens: estimateTokens(goalsText),
      mustKeep: false,
    });
  }

  if (trend) {
    const trendText =
      `# Last week\n` +
      `- Execution: ${trend.executionPattern}\n` +
      `- Most effective trigger: ${trend.mostEffectiveTrigger}\n` +
      `- Most missed day: ${trend.mostMissedDay}\n` +
      `- Emotional arc: ${trend.emotionalArc}`;
    segments.push({
      id: 'trend',
      level: levelForIntent('trend', intent),
      text: trendText,
      tokens: estimateTokens(trendText),
      mustKeep: false,
    });
  }

  if (recent.length > tailCount) {
    const older = recent.slice(0, recent.length - tailCount);
    const olderText = older.map((m) => `${m.role}: ${m.content}`).join('\n');
    segments.push({
      id: 'history_older',
      level: 4,
      text: olderText,
      tokens: estimateTokens(olderText),
      mustKeep: false,
    });
  }

  if (digests.length > 0) {
    const digestText = digests
      .map((d) => `- (${d.startedAt.slice(0, 10)}) ${d.topic}: ${d.progress}`)
      .join('\n');
    segments.push({
      id: 'digests',
      level: levelForIntent('digests', intent),
      text: digestText,
      tokens: estimateTokens(digestText),
      mustKeep: false,
    });
  }

  const dropped: SegmentId[] = [];
  let total = segments.reduce((n, s) => n + s.tokens, 0);
  while (total > budget) {
    const dropIdx = findHighestDroppable(segments);
    if (dropIdx === -1) break;
    const removed = segments.splice(dropIdx, 1)[0]!;
    dropped.push(removed.id);
    total -= removed.tokens;
  }

  const kept = segments.map((s) => s.id);
  const promptHead = segments
    .filter((s) => s.id === 'system' || s.id === 'profile' || s.id === 'goals' || s.id === 'trend' || s.id === 'digests')
    .map((s) => s.text)
    .join('\n\n');

  const messages: ChatMessage[] = [];
  const olderSeg = segments.find((s) => s.id === 'history_older');
  if (olderSeg) {
    // Re-insert the older messages as real turns, not as a prompt blob.
    for (const m of recent.slice(0, recent.length - tailCount)) {
      messages.push(m);
    }
  }
  for (const m of tail) messages.push(m);
  messages.push({ role: 'user', content: input.userMessage });

  return {
    systemPrompt: promptHead,
    messages,
    meta: {
      tokenEstimate: total,
      budget,
      intent,
      includedSegments: kept,
      droppedSegments: dropped,
      buildDurationMs: Date.now() - started,
    },
  };
}

function levelForIntent(
  segment: 'goals' | 'trend' | 'digests',
  intent: Intent,
): Segment['level'] {
  if (segment === 'goals') {
    if (intent === 'progress_report' || intent === 'goal_query' || intent === 'goal_adjust') return 1;
    return 2;
  }
  if (segment === 'trend') {
    if (intent === 'emotion') return 1;
    return 3;
  }
  if (segment === 'digests') {
    if (intent === 'retro_request' || intent === 'emotion') return 2;
    return 5;
  }
  return 3;
}

function findHighestDroppable(segments: Segment[]): number {
  let idx = -1;
  let highestLevel = -1;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (s.mustKeep) continue;
    if (s.level > highestLevel) {
      highestLevel = s.level;
      idx = i;
    }
  }
  return idx;
}

function renderProfile(p: {
  name: string;
  city?: string | undefined;
  role?: string | undefined;
  values: string[];
  about: string;
}): string {
  const lines = [`# Profile`, `- Name: ${p.name}`];
  if (p.city) lines.push(`- City: ${p.city}`);
  if (p.role) lines.push(`- Role: ${p.role}`);
  if (p.values.length > 0) lines.push(`- Values: ${p.values.join(', ')}`);
  if (p.about.trim()) {
    lines.push('');
    lines.push(p.about.trim());
  }
  return lines.join('\n');
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough bilingual approximation: CJK ~1 tok/char, latin ~1 tok/4 chars.
  let cjk = 0;
  let latin = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x4e00 && code <= 0x9fff) cjk += 1;
    else latin += 1;
  }
  return Math.ceil(cjk + latin / 4);
}
