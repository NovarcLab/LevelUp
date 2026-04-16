import type { Logger } from 'pino';
import { execSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ARCHIVE_AGE_DAYS = 90;

/**
 * Monthly digest archive: 1st at 05:00.
 * Moves digest files older than 90 days into archive/{year}.tar.
 */
export function createDigestArchive(dataRoot: string, log: Logger) {
  return async function digestArchive(): Promise<void> {
    const tenantsDir = join(dataRoot, 'tenants');
    let tenantIds: string[];
    try {
      tenantIds = readdirSync(tenantsDir);
    } catch {
      return;
    }

    const cutoff = Date.now() - ARCHIVE_AGE_DAYS * 24 * 3600 * 1000;
    const year = new Date().getFullYear().toString();

    for (const tenantId of tenantIds) {
      const digestsDir = join(tenantsDir, tenantId, 'digests');
      const archiveDir = join(tenantsDir, tenantId, 'archive');

      try {
        const files = readdirSync(digestsDir);
        const old = files.filter((f) => {
          try {
            const stat = statSync(join(digestsDir, f));
            return stat.mtimeMs < cutoff;
          } catch {
            return false;
          }
        });

        if (old.length === 0) continue;

        mkdirSync(archiveDir, { recursive: true });
        const archivePath = join(archiveDir, `${year}.tar`);

        // Append old files to the yearly tar
        const fileArgs = old.map((f) => `"${f}"`).join(' ');
        execSync(
          `tar -rf "${archivePath}" -C "${digestsDir}" ${fileArgs}`,
          { timeout: 30000 },
        );

        // Remove archived files
        for (const f of old) {
          unlinkSync(join(digestsDir, f));
        }

        log.info({ tenantId, archived: old.length }, 'digests archived');
      } catch (err) {
        log.error({ tenantId, err }, 'digest archive failed');
      }
    }
  };
}
