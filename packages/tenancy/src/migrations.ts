import type Database from 'better-sqlite3';

/**
 * The tenant.db schema lives here and ONLY here. Notice that no table has
 * a user_id column — a tenant.db file belongs to exactly one user by virtue
 * of being their file. This is the physical root of tenant isolation.
 *
 * Schema changes are applied idempotently on each acquire(). Each migration
 * is a pure SQL string keyed by a monotonic version number.
 */
interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial',
    sql: `
      CREATE TABLE IF NOT EXISTS tenant_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        why_statement TEXT,
        target_completion_date INTEGER,
        status TEXT NOT NULL CHECK(status IN ('active','paused','completed','archived')),
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_goals_status
        ON goals(status, display_order);

      CREATE TABLE IF NOT EXISTS milestones (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        target_week_index INTEGER,
        display_order INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','in_progress','done')),
        completed_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_milestones_goal
        ON milestones(goal_id, display_order);

      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        week_of TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','in_progress','done','skipped')),
        completed_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_actions_milestone
        ON actions(milestone_id, week_of);

      CREATE TABLE IF NOT EXISTS implementation_intentions (
        id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
        trigger TEXT NOT NULL,
        behavior TEXT NOT NULL,
        termination TEXT NOT NULL,
        fallback TEXT,
        status TEXT NOT NULL CHECK(status IN ('active','retired')),
        success_count INTEGER NOT NULL DEFAULT 0,
        fail_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        retired_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_ii_action_active
        ON implementation_intentions(action_id, status);

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        context_goal_id TEXT REFERENCES goals(id),
        started_at INTEGER NOT NULL,
        last_msg_at INTEGER NOT NULL,
        ended_at INTEGER,
        digest_written INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'web',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conv_recent
        ON conversations(last_msg_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conv_pending_digest
        ON conversations(digest_written, last_msg_at);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content TEXT NOT NULL,
        embedded_cards TEXT,
        edited_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv
        ON messages(conversation_id, created_at);
    `,
  },
];

export function runTenantMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM _migrations').all() as { version: number }[],
  );
  const appliedVersions = new Set(
    [...applied].map((row) => (row as unknown as { version: number }).version),
  );

  const insert = db.prepare(
    'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;
    const tx = db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.version, migration.name, Date.now());
    });
    tx();
  }
}
