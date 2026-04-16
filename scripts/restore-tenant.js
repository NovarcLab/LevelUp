#!/usr/bin/env node

/**
 * Restore a single tenant from a backup tar.gz file.
 *
 * Usage: node scripts/restore-tenant.js <tenantId> <backup.tar.gz>
 *
 * The script extracts the tenant directory from the archive into
 * the data/tenants/ directory, replacing any existing data.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const [,, tenantId, backupPath] = process.argv;

if (!tenantId || !backupPath) {
  console.error('Usage: node scripts/restore-tenant.js <tenantId> <backup.tar.gz>');
  process.exit(1);
}

const dataRoot = resolve(process.env.DATA_ROOT ?? './data');
const tenantsDir = join(dataRoot, 'tenants');
const targetDir = join(tenantsDir, tenantId);
const resolvedBackup = resolve(backupPath);

if (!existsSync(resolvedBackup)) {
  console.error(`Backup file not found: ${resolvedBackup}`);
  process.exit(1);
}

console.log(`Restoring tenant ${tenantId} from ${resolvedBackup}`);

// Remove existing tenant data if present
if (existsSync(targetDir)) {
  console.log(`Removing existing tenant data at ${targetDir}`);
  rmSync(targetDir, { recursive: true });
}

mkdirSync(tenantsDir, { recursive: true });

// Extract the tenant directory from the archive
try {
  execSync(`tar -xzf "${resolvedBackup}" -C "${tenantsDir}" "${tenantId}"`, {
    stdio: 'inherit',
    timeout: 60000,
  });
  console.log(`Tenant ${tenantId} restored successfully to ${targetDir}`);
} catch (err) {
  console.error(`Failed to restore tenant: ${err}`);
  process.exit(1);
}
