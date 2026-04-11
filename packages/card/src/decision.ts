import type { TenantContext } from '@levelup/tenancy';
import type { CardPayload, Intent, GoalSnapshot } from '@levelup/shared';
import { goalTree } from '@levelup/goal-tree';

export interface CardDecisionInput {
  userMessage: string;
  intent: Intent;
  lastCardAt?: number;
  messagesSinceLastCard?: number;
  silenceDays?: number;
}

/**
 * Density-gated card decider.
 *
 *  - at most 1 card per call (caller handles per-session cap of 2)
 *  - no card within 3 messages of the last one
 *  - no card within 1h of the last one of the same type (checked by caller)
 */
export async function decideCard(
  ctx: TenantContext,
  input: CardDecisionInput,
): Promise<CardPayload | null> {
  if ((input.messagesSinceLastCard ?? Infinity) < 3) return null;

  const snapshots = await goalTree.activeSnapshot(ctx);
  if (snapshots.length === 0) return null;

  switch (input.intent) {
    case 'progress_report':
      return progressCard(snapshots) ?? null;
    case 'goal_query':
      return locateCard(snapshots) ?? null;
    case 'emotion':
      return encourageCard() ?? null;
    case 'retro_request':
      return summaryCard(snapshots);
    default:
      if ((input.silenceDays ?? 0) >= 3) return summaryCard(snapshots);
      return null;
  }
}

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

function encourageCard(): CardPayload {
  return {
    type: 'encourage',
    doneActions: [],
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
