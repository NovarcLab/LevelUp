import type { Logger } from 'pino';
import type { TenantRegistry } from '@levelup/tenancy';
import { emit } from '@levelup/shared';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SILENCE_THRESHOLD_MS = 7 * 24 * 3600 * 1000; // 7 days

/**
 * Hourly silence detection: marks users who haven't messaged in 7+ days.
 * Emits silence.detected event so conversation.resolveOpeningMessage
 * returns 'reconnect'.
 */
export function createSilenceDetect(
  registry: TenantRegistry,
  dataRoot: string,
  log: Logger,
) {
  return async function silenceDetect(): Promise<void> {
    const tenantsDir = join(dataRoot, 'tenants');
    let tenantIds: string[];
    try {
      tenantIds = readdirSync(tenantsDir);
    } catch {
      return;
    }

    const cutoff = Date.now() - SILENCE_THRESHOLD_MS;

    for (const tenantId of tenantIds) {
      let ctx;
      try {
        ctx = await registry.acquire(tenantId);
      } catch {
        continue;
      }

      try {
        const row = ctx.db
          .prepare(
            'SELECT last_msg_at FROM conversations ORDER BY last_msg_at DESC LIMIT 1',
          )
          .get() as { last_msg_at: number } | undefined;

        if (row && row.last_msg_at < cutoff) {
          emit('silence.detected', {
            userId: tenantId,
            lastMessageAt: new Date(row.last_msg_at).toISOString(),
          });
          log.info({ tenantId, lastAt: row.last_msg_at }, 'silence detected');
        }
      } catch (err) {
        log.error({ tenantId, err }, 'silence detection failed');
      } finally {
        registry.release(ctx);
      }
    }
  };
}
