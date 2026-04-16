import type { Logger } from 'pino';
import type { TenantRegistry } from '@levelup/tenancy';
import { memoryStore } from '@levelup/memory';
import type { LLMClient } from '@levelup/llm';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Weekly aggregation: Sunday 23:00.
 * Merges the week's digests into an L4 trend entry.
 */
export function createWeeklyAggregate(
  registry: TenantRegistry,
  llm: LLMClient,
  dataRoot: string,
  log: Logger,
) {
  return async function weeklyAggregate(): Promise<void> {
    const tenantsDir = join(dataRoot, 'tenants');
    let tenantIds: string[];
    try {
      tenantIds = readdirSync(tenantsDir);
    } catch {
      return;
    }

    // Current ISO week
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000,
    );
    const isoWeek = Math.ceil((dayOfYear + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
    const isoWeekStr = `${now.getFullYear()}-W${String(isoWeek).padStart(2, '0')}`;

    for (const tenantId of tenantIds) {
      let ctx;
      try {
        ctx = await registry.acquire(tenantId);
      } catch {
        continue;
      }

      try {
        const digests = await memoryStore.readRecentDigests(ctx, 30);
        // Filter to this week's digests
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekDigests = digests.filter(
          (d) => new Date(d.startedAt).getTime() >= weekStart.getTime(),
        );

        if (weekDigests.length === 0) continue;

        // Summarize via LLM
        const digestSummary = weekDigests
          .map((d) => `- ${d.topic} (mood: ${d.mood})`)
          .join('\n');

        let trendText = '';
        for await (const event of llm.stream({
          systemPrompt:
            'You analyze weekly patterns. Respond in this format:\nExecution pattern: ...\nTriggers that worked: ...\nRecurring blockers: ...',
          messages: [
            {
              role: 'user',
              content: `Summarize this week's sessions:\n${digestSummary}`,
            },
          ],
        })) {
          if (event.type === 'token') trendText += event.text;
        }

        await memoryStore.writeTrend(ctx, isoWeekStr, {
          isoWeek: isoWeekStr,
          executionPattern: trendText,
          mostEffectiveTrigger: '',
          mostMissedDay: '',
          emotionalArc: '',
          recurringBlockers: [],
        });

        log.info({ tenantId, isoWeek: isoWeekStr, digestCount: weekDigests.length }, 'weekly trend written');
      } catch (err) {
        log.error({ tenantId, err }, 'weekly aggregate failed');
      } finally {
        registry.release(ctx);
      }
    }
  };
}
