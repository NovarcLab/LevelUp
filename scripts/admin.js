#!/usr/bin/env node

/**
 * Admin CLI for tenant management.
 *
 * Usage:
 *   node scripts/admin.js list-tenants
 *   node scripts/admin.js tenant-stats <tenantId>
 *   node scripts/admin.js delete-tenant <tenantId>
 */

import { readdirSync, statSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import Database from 'better-sqlite3';

const dataRoot = resolve(process.env.DATA_ROOT ?? './data');
const tenantsDir = join(dataRoot, 'tenants');
const [,, command, ...args] = process.argv;

function listTenants() {
  let tenantIds;
  try {
    tenantIds = readdirSync(tenantsDir).filter((f) => {
      const stat = statSync(join(tenantsDir, f));
      return stat.isDirectory();
    });
  } catch {
    console.log('No tenants found.');
    return;
  }

  console.log(`Found ${tenantIds.length} tenant(s):\n`);
  for (const id of tenantIds) {
    const dir = join(tenantsDir, id);
    const dbPath = join(dir, 'tenant.db');
    let convCount = 0;
    let goalCount = 0;
    let lastActivity = '—';

    try {
      const db = new Database(dbPath, { readonly: true });
      const conv = db.prepare('SELECT COUNT(*) as c FROM conversations').get();
      const goal = db.prepare('SELECT COUNT(*) as c FROM goals').get();
      const last = db.prepare('SELECT MAX(last_msg_at) as t FROM conversations').get();
      convCount = conv?.c ?? 0;
      goalCount = goal?.c ?? 0;
      if (last?.t) lastActivity = new Date(last.t).toISOString().slice(0, 10);
      db.close();
    } catch { /* skip */ }

    const dirStat = statSync(dir);
    console.log(`  ${id}`);
    console.log(`    Created:       ${dirStat.birthtime.toISOString().slice(0, 10)}`);
    console.log(`    Conversations: ${convCount}`);
    console.log(`    Goals:         ${goalCount}`);
    console.log(`    Last activity: ${lastActivity}`);
    console.log();
  }
}

function tenantStats(tenantId) {
  if (!tenantId) {
    console.error('Usage: admin.js tenant-stats <tenantId>');
    process.exit(1);
  }

  const dir = join(tenantsDir, tenantId);
  const dbPath = join(dir, 'tenant.db');

  try {
    const db = new Database(dbPath, { readonly: true });
    const convs = db.prepare('SELECT COUNT(*) as c FROM conversations').get();
    const goals = db.prepare('SELECT COUNT(*) as c FROM goals').get();
    const msgs = db.prepare('SELECT COUNT(*) as c FROM messages').get();
    const lastConv = db.prepare('SELECT MAX(last_msg_at) as t FROM conversations').get();

    console.log(`Tenant: ${tenantId}`);
    console.log(`  Conversations: ${convs?.c ?? 0}`);
    console.log(`  Messages:      ${msgs?.c ?? 0}`);
    console.log(`  Goals:         ${goals?.c ?? 0}`);
    console.log(`  Last activity: ${lastConv?.t ? new Date(lastConv.t).toISOString() : '—'}`);

    // Disk usage
    const { execSync } = await import('node:child_process');
    const du = execSync(`du -sh "${dir}"`).toString().trim().split('\t')[0];
    console.log(`  Disk usage:    ${du}`);

    db.close();
  } catch (err) {
    console.error(`Failed to read tenant ${tenantId}: ${err}`);
    process.exit(1);
  }
}

function deleteTenant(tenantId) {
  if (!tenantId) {
    console.error('Usage: admin.js delete-tenant <tenantId>');
    process.exit(1);
  }

  const dir = join(tenantsDir, tenantId);
  console.log(`Deleting tenant ${tenantId} at ${dir}`);
  try {
    rmSync(dir, { recursive: true });
    console.log(`Tenant ${tenantId} deleted.`);
  } catch (err) {
    console.error(`Failed: ${err}`);
    process.exit(1);
  }
}

switch (command) {
  case 'list-tenants':
    listTenants();
    break;
  case 'tenant-stats':
    tenantStats(args[0]);
    break;
  case 'delete-tenant':
    deleteTenant(args[0]);
    break;
  default:
    console.log(`LevelUp Admin CLI

Commands:
  list-tenants           List all tenants with stats
  tenant-stats <id>      Show detailed stats for a tenant
  delete-tenant <id>     Permanently delete a tenant`);
}
