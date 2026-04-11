import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTenantRegistry, TenantRegistry } from './registry.js';
import { TenantNotFoundError, TenantAlreadyExistsError, InvalidTenantIdError } from '@levelup/shared';

describe('TenantRegistry', () => {
  let dataRoot: string;
  let registry: TenantRegistry;

  beforeEach(async () => {
    dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'levelup-test-'));
    registry = createTenantRegistry({ dataRoot, maxOpenTenants: 4 });
  });

  afterEach(async () => {
    await registry.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it('provisions a new tenant with a usable db and workspace', async () => {
    const ctx = await registry.provision('user-alpha1');
    expect(ctx.tenantId).toBe('user-alpha1');
    expect(ctx.tenantDir).toContain('tenants');

    // schema is applied
    const rows = ctx.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toContain('goals');
    expect(names).toContain('conversations');
    expect(names).toContain('messages');

    // workspace is ready
    expect(await ctx.workspace.exists('digests')).toBe(true);
    expect(await ctx.workspace.exists('trends')).toBe(true);

    registry.release(ctx);
  });

  it('rejects provisioning the same tenant twice', async () => {
    await registry.provision('user-bravo1');
    await expect(registry.provision('user-bravo1')).rejects.toBeInstanceOf(
      TenantAlreadyExistsError,
    );
  });

  it('acquire throws TenantNotFoundError for unknown tenants', async () => {
    await expect(registry.acquire('user-ghost1')).rejects.toBeInstanceOf(
      TenantNotFoundError,
    );
  });

  it('acquire reuses the same context for hot tenants', async () => {
    const a = await registry.provision('user-hot1234');
    const b = await registry.acquire('user-hot1234');
    expect(a).toBe(b);
    expect(registry.getStats().hits).toBeGreaterThanOrEqual(1);
    registry.release(a);
    registry.release(b);
  });

  it('rejects invalid tenantIds (path traversal defense)', async () => {
    await expect(registry.acquire('../evil-sibling')).rejects.toBeInstanceOf(
      InvalidTenantIdError,
    );
    await expect(registry.provision('bad')).rejects.toBeInstanceOf(InvalidTenantIdError);
    await expect(registry.provision('a/../b')).rejects.toBeInstanceOf(
      InvalidTenantIdError,
    );
  });

  it('isolates data between two tenants physically', async () => {
    const alpha = await registry.provision('user-alpha9');
    const bravo = await registry.provision('user-bravo9');

    alpha.db
      .prepare(
        `INSERT INTO goals (id,title,why_statement,target_completion_date,status,display_order,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run('g1', 'Alpha Goal', null, null, 'active', 0, Date.now(), Date.now());

    const alphaRows = alpha.db.prepare('SELECT id FROM goals').all();
    const bravoRows = bravo.db.prepare('SELECT id FROM goals').all();
    expect(alphaRows).toHaveLength(1);
    expect(bravoRows).toHaveLength(0);

    // files are in different dirs
    expect(alpha.tenantDir).not.toBe(bravo.tenantDir);

    registry.release(alpha);
    registry.release(bravo);
  });

  it('deprovision removes the directory and evicts the cache', async () => {
    const ctx = await registry.provision('user-delta1');
    const dir = ctx.tenantDir;
    expect(
      await fs
        .access(dir)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    await registry.deprovision('user-delta1');

    expect(
      await fs
        .access(dir)
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
    await expect(registry.acquire('user-delta1')).rejects.toBeInstanceOf(
      TenantNotFoundError,
    );
  });

  it('workspace writeTextAtomic + readText round-trips', async () => {
    const ctx = await registry.provision('user-echo123');
    await ctx.workspace.writeTextAtomic('PROFILE.md', '# Hello\n');
    expect(await ctx.workspace.readText('PROFILE.md')).toBe('# Hello\n');
    registry.release(ctx);
  });

  it('workspace blocks path traversal attempts', async () => {
    const ctx = await registry.provision('user-fox12345');
    await expect(
      ctx.workspace.readText('../system.db'),
    ).rejects.toThrow(/path traversal/);
    registry.release(ctx);
  });
});
