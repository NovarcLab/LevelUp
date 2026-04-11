import type { Action, DerivedStatus } from '@levelup/shared';

const DAY_MS = 86_400_000;

/**
 * Derive a status from the most recent action activity. Never stored — always
 * recomputed on read, so status rules can be tweaked without a migration.
 */
export function deriveStatus(
  actions: Action[],
  percent: number,
  now: number = Date.now(),
): DerivedStatus {
  if (percent >= 80) return 'near-done';

  const withTime = actions
    .map((a) => a.completedAt ?? 0)
    .filter((t) => t > 0)
    .sort((a, b) => b - a);
  const lastActivity = withTime[0] ?? 0;
  const daysSince = lastActivity === 0 ? Infinity : (now - lastActivity) / DAY_MS;

  const missedStreak = countTrailingSkips(actions);
  if (daysSince > 14 || missedStreak >= 3) return 'stuck';
  if (daysSince > 7) return 'at-risk';
  return 'active';
}

function countTrailingSkips(actions: Action[]): number {
  let count = 0;
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i];
    if (!a) break;
    if (a.status === 'skipped') count += 1;
    else if (a.status === 'done') break;
  }
  return count;
}

export function percentComplete(actions: Action[]): number {
  if (actions.length === 0) return 0;
  const done = actions.filter((a) => a.status === 'done').length;
  return Math.round((done / actions.length) * 100);
}
