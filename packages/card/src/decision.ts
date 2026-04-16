import type { TenantContext } from '@levelup/tenancy';
import type { CardPayload, Intent, GoalSnapshot } from '@levelup/shared';
import { on } from '@levelup/shared';
import { goalTree } from '@levelup/goal-tree';
import { memoryStore } from '@levelup/memory';

export interface CardDecisionInput {
  userMessage: string;
  intent: Intent;
  lastCardAt?: number;
  messagesSinceLastCard?: number;
  silenceDays?: number;
}

/* ── 1h same-type dedup ─────────────────────────── */

interface RecentCard {
  type: string;
  at: number;
}

function recentCardsFromMessages(ctx: TenantContext): RecentCard[] {
  const cutoff = Date.now() - 3600 * 1000; // 1 hour
  const rows = ctx.db
    .prepare(
      `SELECT embedded_cards, created_at FROM messages
       WHERE role = 'assistant' AND embedded_cards IS NOT NULL AND created_at > ?
       ORDER BY created_at DESC LIMIT 10`,
    )
    .all(cutoff) as { embedded_cards: string; created_at: number }[];

  const result: RecentCard[] = [];
  for (const row of rows) {
    try {
      const cards = JSON.parse(row.embedded_cards) as { type: string }[];
      for (const c of cards) {
        result.push({ type: c.type, at: row.created_at });
      }
    } catch { /* skip malformed */ }
  }
  return result;
}

function wasSameTypeWithin1h(ctx: TenantContext, cardType: string): boolean {
  const recent = recentCardsFromMessages(ctx);
  return recent.some((r) => r.type === cardType);
}

/* ── Card decision ──────────────────────────────── */

/**
 * Density-gated card decider.
 *
 *  - at most 1 card per call (caller handles per-session cap of 2)
 *  - no card within 3 messages of the last one
 *  - no same-type card within 1 hour (persisted check)
 */
export async function decideCard(
  ctx: TenantContext,
  input: CardDecisionInput,
): Promise<CardPayload | null> {
  if ((input.messagesSinceLastCard ?? Infinity) < 3) return null;

  const snapshots = await goalTree.activeSnapshot(ctx);
  if (snapshots.length === 0) return null;

  let candidate: CardPayload | null = null;

  switch (input.intent) {
    case 'progress_report':
      candidate = progressCard(snapshots);
      break;
    case 'goal_query':
      candidate = locateCard(snapshots);
      break;
    case 'emotion':
      candidate = await encourageCard(ctx);
      break;
    case 'retro_request':
      candidate = summaryCard(snapshots);
      break;
    default:
      if ((input.silenceDays ?? 0) >= 3) candidate = summaryCard(snapshots);
      break;
  }

  // 1h same-type dedup
  if (candidate && wasSameTypeWithin1h(ctx, candidate.type)) {
    return null;
  }

  return candidate;
}

/* ── celebrate card via eventBus ─────────────────── */

/**
 * Call once at startup to wire milestone.completed → celebrate card.
 * Returns a cleanup function.
 */
export function registerCelebrateListener(): () => void {
  return on('milestone.completed', (payload) => {
    // The celebrate card is injected by the conversation handler
    // which reads the pending celebration from a global signal.
    // Store the event so the next message response can include it.
    pendingCelebrations.push(payload);
  });
}

const pendingCelebrations: { userId: string; goalId: string; milestoneId: string }[] = [];

export function popCelebration(userId: string): { goalId: string; milestoneId: string } | null {
  const idx = pendingCelebrations.findIndex((c) => c.userId === userId);
  if (idx === -1) return null;
  const [celebration] = pendingCelebrations.splice(idx, 1);
  return celebration ? { goalId: celebration.goalId, milestoneId: celebration.milestoneId } : null;
}

/* ── Card builders ──────────────────────────────── */

function progressCard(snapshots: GoalSnapshot[]): CardPayload | null {
  const top = [...snapshots].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!top) return null;
  return {
    type: 'progress',
    goalId: top.id,
    title: top.title,
    percent: top.percent,
    nextStep: top.currentMilestone ?? 'Pick the next step',
  };
}

function locateCard(snapshots: GoalSnapshot[]): CardPayload | null {
  const top = snapshots[0];
  if (!top) return null;
  return {
    type: 'locate',
    goalId: top.id,
    trail: [top.title, top.currentMilestone ?? '—'],
    currentNode: top.currentMilestone ?? top.title,
  };
}

async function encourageCard(ctx: TenantContext): Promise<CardPayload> {
  // Pull real completed actions from recent digests
  const digests = await memoryStore.readRecentDigests(ctx, 10);
  const doneActions = digests
    .filter((d) => d.progress && d.progress.length > 0)
    .slice(0, 5)
    .map((d) => ({
      title: d.progress,
      at: new Date(d.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));

  return {
    type: 'encourage',
    doneActions,
    days: 30,
  };
}

function summaryCard(snapshots: GoalSnapshot[]): CardPayload {
  return {
    type: 'summary',
    goals: snapshots.slice(0, 3).map((g) => ({
      id: g.id,
      title: g.title,
      percent: g.percent,
      headline: g.currentMilestone ?? g.derivedStatus,
    })),
  };
}
