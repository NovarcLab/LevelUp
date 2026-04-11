import path from 'node:path';
import { promises as fs } from 'node:fs';
import Database from 'better-sqlite3';
import { LRUCache } from 'lru-cache';
import { Mutex } from 'async-mutex';
import {
  TenantNotFoundError,
  TenantAlreadyExistsError,
  type TenantId,
} from '@levelup/shared';
import type { TenantContext, TenantDb, VectorStore } from './context.js';
import { resolveTenantDir } from './paths.js';
import { createWorkspaceFs } from './workspace-fs.js';
import { runTenantMigrations } from './migrations.js';

export interface TenantRegistryOptions {
  dataRoot: string;
  maxOpenTenants?: number;
  /** Injected for tests — returns a VectorStore for a given tenant dir. */
  vectorStoreFactory?: (tenantDir: string) => VectorStore;
}

export interface RegistryStats {
  openTenants: number;
  maxOpenTenants: number;
  hits: number;
  misses: number;
  evictions: number;
}

interface OpenTenant {
  ctx: TenantContext;
  mutex: Mutex;
  refcount: number;
}

/**
 * A TenantRegistry owns the lifecycle of open tenant connections.
 *
 *  - acquire(id) returns a TenantContext, reusing a cached connection if hot
 *  - release(ctx) drops the refcount; when 0, the connection is eligible
 *    for LRU eviction but not closed immediately
 *  - provision(id) creates a brand new tenant (dir + db + migrations)
 *  - deprovision(id) evicts and rm -rf's the entire tenant dir
 *
 * All mutations of registry state go through acquireMu to keep LRU consistent.
 */
export class TenantRegistry {
  private readonly dataRoot: string;
  private readonly cache: LRUCache<string, OpenTenant>;
  private readonly acquireMu = new Mutex();
  private readonly vectorStoreFactory: (dir: string) => VectorStore;
  private stats: RegistryStats;

  constructor(options: TenantRegistryOptions) {
    this.dataRoot = path.resolve(options.dataRoot);
    this.vectorStoreFactory = options.vectorStoreFactory ?? noopVectorStore;
    this.stats = {
      openTenants: 0,
      maxOpenTenants: options.maxOpenTenants ?? 256,
      hits: 0,
      misses: 0,
      evictions: 0,
    };
    this.cache = new LRUCache<string, OpenTenant>({
      max: this.stats.maxOpenTenants,
      dispose: (value, _key, reason) => {
        if (reason === 'evict' || reason === 'delete') {
          this.stats.evictions += reason === 'evict' ? 1 : 0;
          this.closeTenant(value);
        }
      },
    });
  }

  /**
   * Opens (or reuses) a tenant connection. Throws TenantNotFoundError if the
   * tenant directory does not exist — acquire never creates new tenants.
   */
  async acquire(tenantId: string): Promise<TenantContext> {
    return this.acquireMu.runExclusive(async () => {
      const hit = this.cache.get(tenantId);
      if (hit) {
        hit.refcount += 1;
        this.stats.hits += 1;
        return hit.ctx;
      }

      const tenantDir = resolveTenantDir(this.dataRoot, tenantId);
      const dbPath = path.join(tenantDir, 'tenant.db');
      try {
        await fs.access(dbPath);
      } catch {
        throw new TenantNotFoundError(tenantId);
      }

      const ctx = this.openTenant(tenantId as TenantId, tenantDir);
      this.cache.set(tenantId, { ctx, mutex: new Mutex(), refcount: 1 });
      this.stats.openTenants = this.cache.size;
      this.stats.misses += 1;
      return ctx;
    });
  }

  release(ctx: TenantContext): void {
    const entry = this.cache.peek(ctx.tenantId);
    if (!entry) return;
    entry.refcount = Math.max(0, entry.refcount - 1);
  }

  /**
   * Creates a brand-new tenant. Fails if the directory already exists.
   * All side effects are rolled back on any error.
   */
  async provision(tenantId: string): Promise<TenantContext> {
    return this.acquireMu.runExclusive(async () => {
      const tenantDir = resolveTenantDir(this.dataRoot, tenantId);
      try {
        await fs.access(tenantDir);
        throw new TenantAlreadyExistsError(tenantId);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }

      try {
        await fs.mkdir(tenantDir, { recursive: true });
        await fs.mkdir(path.join(tenantDir, 'digests'), { recursive: true });
        await fs.mkdir(path.join(tenantDir, 'trends'), { recursive: true });
        await fs.mkdir(path.join(tenantDir, 'vectors'), { recursive: true });
        await fs.mkdir(path.join(tenantDir, 'locks'), { recursive: true });

        const ctx = this.openTenant(tenantId as TenantId, tenantDir);
        this.cache.set(tenantId, { ctx, mutex: new Mutex(), refcount: 1 });
        this.stats.openTenants = this.cache.size;
        return ctx;
      } catch (err) {
        await fs.rm(tenantDir, { recursive: true, force: true });
        throw err;
      }
    });
  }

  /**
   * Evicts the tenant from cache and removes its directory from disk.
   * Idempotent — missing tenants are treated as already deprovisioned.
   */
  async deprovision(tenantId: string): Promise<void> {
    return this.acquireMu.runExclusive(async () => {
      const entry = this.cache.peek(tenantId);
      if (entry) {
        this.closeTenant(entry);
        this.cache.delete(tenantId);
      }
      const tenantDir = resolveTenantDir(this.dataRoot, tenantId);
      await fs.rm(tenantDir, { recursive: true, force: true });
      this.stats.openTenants = this.cache.size;
    });
  }

  /**
   * Closes all open tenants. Call on shutdown.
   */
  async close(): Promise<void> {
    return this.acquireMu.runExclusive(async () => {
      for (const [_, entry] of this.cache.entries()) {
        this.closeTenant(entry);
      }
      this.cache.clear();
      this.stats.openTenants = 0;
    });
  }

  getStats(): Readonly<RegistryStats> {
    return { ...this.stats, openTenants: this.cache.size };
  }

  private openTenant(tenantId: TenantId, tenantDir: string): TenantContext {
    const dbPath = path.join(tenantDir, 'tenant.db');
    const db = new Database(dbPath) as TenantDb;
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');
    runTenantMigrations(db);

    return {
      tenantId,
      tenantDir,
      db,
      vectors: this.vectorStoreFactory(tenantDir),
      workspace: createWorkspaceFs(tenantDir),
    };
  }

  private closeTenant(entry: OpenTenant): void {
    try {
      entry.ctx.vectors.close();
    } catch {
      /* ignore */
    }
    try {
      entry.ctx.db.close();
    } catch {
      /* ignore */
    }
  }
}

export function createTenantRegistry(options: TenantRegistryOptions): TenantRegistry {
  return new TenantRegistry(options);
}

function noopVectorStore(_dir: string): VectorStore {
  return {
    upsert: () => {},
    query: () => [],
    remove: () => {},
    close: () => {},
  };
}
