import type Database from 'better-sqlite3';
import type { TenantId } from '@levelup/shared';

/**
 * A SQLite database connection that is statically known to belong to a
 * single tenant. Business modules only accept this branded type, so it is
 * impossible to accidentally query across tenants — the tenant.db schema
 * does not even contain a user_id column.
 */
export type TenantDb = Database.Database & { readonly __tenant: unique symbol };

export interface VectorStore {
  upsert(id: string, embedding: Float32Array): void;
  query(embedding: Float32Array, k: number): { id: string; distance: number }[];
  remove(id: string): void;
  close(): void;
}

export interface WorkspaceFs {
  readonly root: string;
  join(...segments: string[]): string;
  readText(relPath: string): Promise<string>;
  readTextOrNull(relPath: string): Promise<string | null>;
  writeTextAtomic(relPath: string, content: string): Promise<void>;
  appendText(relPath: string, content: string): Promise<void>;
  remove(relPath: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;
  listDir(relPath: string): Promise<string[]>;
  mkdirp(relPath: string): Promise<void>;
}

/**
 * Everything a business module needs to operate on one tenant's data.
 * Acquired via TenantRegistry.acquire and released on response end.
 */
export interface TenantContext {
  readonly tenantId: TenantId;
  readonly tenantDir: string;
  readonly db: TenantDb;
  readonly vectors: VectorStore;
  readonly workspace: WorkspaceFs;
}
