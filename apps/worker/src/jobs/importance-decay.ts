import type { Logger } from 'pino';
import type { TenantRegistry } from '@levelup/tenancy';
import { memoryStore } from '@levelup/memory';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const DECAY_FACTOR = 0.85;

/**
 * Weekly importance decay: reduces digest importance scores by 15%.
 * Runs Monday at 04:00.
 */
export function createImportanceDecay(
  registry: TenantRegistry,
  dataRoot: string,
  log: Logger,
) {
  return async function importanceDecay(): Promise<void> {
    const tenantsDir = join(dataRoot, 'tenants');
    let tenantIds: string[];
    try {
      tenantIds = readdirSync(tenantsDir);
    } catch {
      return;
    }

    for (const tenantId of tenantIds) {
      let ctx;
      try {
        ctx = await registry.acquire(tenantId);
      } catch {
        continue;
      }

      try {
        const digests = await memoryStore.readRecentDigests(ctx, 100);
        for (const d of digests) {
          const newScore = Math.max(10, Math.round(d.importance * DECAY_FACTOR));
          if (newScore !== d.importance) {
            await memoryStore.appendDigest(ctx, {
              ...d,
              importance: newScore,
            });
          }
        }
        log.info({ tenantId, count: digests.length }, 'importance decay applied');
      } catch (err) {
        log.error({ tenantId, err }, 'importance decay failed');
      } finally {
        registry.release(ctx);
      }
    }
  };
}
