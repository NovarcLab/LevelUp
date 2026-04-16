import type { Logger } from 'pino';
import { execSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RETENTION_DAYS = 14;

/**
 * Daily backup: 03:00.
 * VACUUM INTO each tenant's DB, then tar the workspace.
 * Retain 14 days of backups.
 */
export function createBackup(dataRoot: string, log: Logger) {
  return async function backup(): Promise<void> {
    const backupDir = join(dataRoot, 'backups');
    mkdirSync(backupDir, { recursive: true });

    const tenantsDir = join(dataRoot, 'tenants');
    let tenantIds: string[];
    try {
      tenantIds = readdirSync(tenantsDir);
    } catch {
      return;
    }

    const dateStr = new Date().toISOString().slice(0, 10);

    for (const tenantId of tenantIds) {
      const tenantDir = join(tenantsDir, tenantId);
      const backupName = `${tenantId}-${dateStr}.tar.gz`;
      const backupPath = join(backupDir, backupName);

      try {
        // VACUUM INTO creates a compacted copy of the DB
        const dbPath = join(tenantDir, 'tenant.db');
        const vacuumPath = join(tenantDir, 'tenant-backup.db');
        try {
          execSync(`sqlite3 "${dbPath}" "VACUUM INTO '${vacuumPath}'"`, { timeout: 30000 });
        } catch {
          // VACUUM INTO may not be available, skip
          log.warn({ tenantId }, 'VACUUM INTO skipped');
        }

        // Tar the workspace
        execSync(`tar -czf "${backupPath}" -C "${tenantsDir}" "${tenantId}"`, { timeout: 60000 });

        // Clean up vacuum copy
        try { unlinkSync(vacuumPath); } catch { /* may not exist */ }

        log.info({ tenantId, backupPath }, 'backup complete');
      } catch (err) {
        log.error({ tenantId, err }, 'backup failed');
      }
    }

    // Prune old backups
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;
    try {
      for (const f of readdirSync(backupDir)) {
        const fPath = join(backupDir, f);
        const stat = statSync(fPath);
        if (stat.mtimeMs < cutoff) {
          unlinkSync(fPath);
          log.info({ file: f }, 'old backup pruned');
        }
      }
    } catch (err) {
      log.error({ err }, 'backup pruning failed');
    }
  };
}
