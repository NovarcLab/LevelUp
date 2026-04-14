import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';
import { personaEngine } from '@levelup/persona';
import { memoryStore } from '@levelup/memory';
import { UnauthorizedError } from '@levelup/shared';
import type { TenantRegistry } from '@levelup/tenancy';

export interface AuthUser {
  id: string;
  email: string;
  tenantDir: string;
  theme: string;
  plan: string;
}

export interface AuthDeps {
  systemDb: Database.Database;
  registry: TenantRegistry;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function newId(): string {
  return nanoid(16);
}

export interface Auth {
  createOrLoginUser(email: string): Promise<{ user: AuthUser; sessionId: string }>;
  getSession(sessionId: string): AuthUser | null;
  destroySession(sessionId: string): void;
  renewSessionIfNeeded(sessionId: string, thresholdMs: number): void;

  // MCP
  createMcpToken(
    userId: string,
    name: string,
    scopes: string[],
  ): Promise<{ id: string; token: string }>;
  listMcpTokens(userId: string): McpTokenSummary[];
  revokeMcpToken(userId: string, tokenId: string): void;
  verifyMcpToken(rawToken: string): {
    user: AuthUser;
    scopes: string[];
    tokenId: string;
  };
}

interface McpTokenSummary {
  id: string;
  name: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
}

export function createAuth(deps: AuthDeps): Auth {
  const { systemDb, registry } = deps;

  return {
    async createOrLoginUser(email: string) {
      let row = systemDb
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(email) as UserRow | undefined;

      if (!row) {
        const id = newId();
        const tenantCtx = await registry.provision(id);
        try {
          await personaEngine.initSoul(tenantCtx);
          await memoryStore.initProfile(tenantCtx, { name: email.split('@')[0] ?? 'friend' });
        } finally {
          registry.release(tenantCtx);
        }
        systemDb
          .prepare(
            `INSERT INTO users (id,email,email_verified,tenant_dir,timezone,theme,plan,created_at)
             VALUES (?,?,?,?,?,?,?,?)`,
          )
          .run(id, email, 1, tenantCtx.tenantDir, 'UTC', 'dark', 'free', Date.now());
        row = systemDb.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
      }

      const user = rowToUser(row);
      const sessionId = newId();
      systemDb
        .prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)')
        .run(sessionId, user.id, Date.now() + SESSION_TTL_MS);
      return { user, sessionId };
    },

    getSession(sessionId: string) {
      const row = systemDb
        .prepare(
          `SELECT u.* FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.id = ? AND s.expires_at > ?`,
        )
        .get(sessionId, Date.now()) as UserRow | undefined;
      return row ? rowToUser(row) : null;
    },

    destroySession(sessionId: string) {
      systemDb.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    },

    renewSessionIfNeeded(sessionId: string, thresholdMs: number) {
      const row = systemDb
        .prepare('SELECT expires_at FROM sessions WHERE id = ?')
        .get(sessionId) as { expires_at: number } | undefined;
      if (!row) return;
      const remaining = row.expires_at - Date.now();
      if (remaining < thresholdMs) {
        systemDb
          .prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
          .run(Date.now() + SESSION_TTL_MS, sessionId);
      }
    },

    async createMcpToken(userId: string, name: string, scopes: string[]) {
      const id = newId();
      const raw = `mcp_live_${nanoid(32)}`;
      const hash = sha256(raw);
      systemDb
        .prepare(
          `INSERT INTO mcp_tokens (id,user_id,token_hash,name,scopes,created_at)
           VALUES (?,?,?,?,?,?)`,
        )
        .run(id, userId, hash, name, JSON.stringify(scopes), Date.now());
      return { id, token: raw };
    },

    listMcpTokens(userId: string): McpTokenSummary[] {
      return (systemDb
        .prepare(
          `SELECT id,name,scopes,created_at,last_used_at FROM mcp_tokens
           WHERE user_id=? AND revoked_at IS NULL ORDER BY created_at DESC`,
        )
        .all(userId) as McpTokenRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        scopes: JSON.parse(r.scopes),
        createdAt: r.created_at,
        lastUsedAt: r.last_used_at,
      }));
    },

    revokeMcpToken(userId: string, tokenId: string) {
      systemDb
        .prepare('UPDATE mcp_tokens SET revoked_at=? WHERE id=? AND user_id=?')
        .run(Date.now(), tokenId, userId);
    },

    verifyMcpToken(rawToken: string) {
      const hash = sha256(rawToken);
      const row = systemDb
        .prepare(
          `SELECT t.id as token_id, t.scopes, u.* FROM mcp_tokens t
           JOIN users u ON u.id = t.user_id
           WHERE t.token_hash = ? AND t.revoked_at IS NULL`,
        )
        .get(hash) as (UserRow & { token_id: string; scopes: string }) | undefined;
      if (!row) throw new UnauthorizedError('invalid MCP token');
      systemDb
        .prepare('UPDATE mcp_tokens SET last_used_at=? WHERE id=?')
        .run(Date.now(), row.token_id);
      return {
        user: rowToUser(row),
        scopes: JSON.parse(row.scopes) as string[],
        tokenId: row.token_id,
      };
    },
  };
}

interface UserRow {
  id: string;
  email: string;
  email_verified: number;
  tenant_dir: string;
  timezone: string;
  ai_companion_name: string | null;
  theme: string;
  plan: string;
  created_at: number;
  deleted_at: number | null;
}

interface McpTokenRow {
  id: string;
  name: string;
  scopes: string;
  created_at: number;
  last_used_at: number | null;
}

function rowToUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    tenantDir: row.tenant_dir,
    theme: row.theme,
    plan: row.plan,
  };
}
