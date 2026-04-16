import { promises as fs } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * system.db is the ONLY database that the api has a global handle to. It
 * holds users, sessions, oauth, magic_links, mcp_tokens — the routing and
 * auth data needed to resolve which tenant a request belongs to.
 *
 * It explicitly does NOT hold any business data (goals, messages, memory).
 * That data lives in per-tenant tenant.db files managed by TenantRegistry.
 */
export async function openSystemDb(dbPath: string): Promise<Database.Database> {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  runSystemMigrations(db);
  return db;
}

function runSystemMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _system_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      tenant_dir TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      ai_companion_name TEXT,
      theme TEXT NOT NULL DEFAULT 'dark',
      plan TEXT NOT NULL DEFAULT 'free',
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS magic_links (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS mcp_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      scopes TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_user ON mcp_tokens(user_id);
  `);

  // Record migration version if not already present
  const existing = db.prepare('SELECT version FROM _system_migrations WHERE version = 1').get();
  if (!existing) {
    db.prepare('INSERT INTO _system_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(1, 'initial_schema', Date.now());
  }
}
