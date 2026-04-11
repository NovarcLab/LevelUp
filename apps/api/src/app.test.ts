import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp, type App } from './app.js';
import type { Config } from './config.js';

async function boot(): Promise<{ config: Config; handle: App; cleanup: () => Promise<void> }> {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'api-test-'));
  const config: Config = {
    dataRoot,
    port: 0,
    sessionSecret: 'test-secret-at-least-16-chars',
    anthropicApiKey: undefined,
    anthropicModelChat: 'claude-sonnet-4-6',
    anthropicModelSummary: 'claude-haiku-4-5-20251001',
    nodeEnv: 'test',
    systemDbPath: path.join(dataRoot, 'system.db'),
  };
  const handle = await createApp(config);
  return {
    config,
    handle,
    cleanup: async () => {
      await handle.close();
      await fs.rm(dataRoot, { recursive: true, force: true });
    },
  };
}

async function login(app: App, email: string): Promise<string> {
  const res = await app.app.inject({
    method: 'POST',
    url: '/api/auth/dev-login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email }),
  });
  if (res.statusCode !== 200) {
    throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  }
  const cookie = res.cookies.find((c) => c.name === 'levelup_session')?.value;
  expect(cookie).toBeDefined();
  return `levelup_session=${cookie}`;
}

describe('api (end-to-end)', () => {
  let boot1: Awaited<ReturnType<typeof boot>>;

  beforeEach(async () => {
    boot1 = await boot();
  });

  afterEach(async () => {
    await boot1.cleanup();
  });

  it('healthz returns ok', async () => {
    const res = await boot1.handle.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('dev-login creates a user and session', async () => {
    const cookie = await login(boot1.handle, 'alice@example.com');
    const me = await boot1.handle.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe('alice@example.com');
  });

  it('creates a goal and lists it', async () => {
    const cookie = await login(boot1.handle, 'bob@example.com');
    const create = await boot1.handle.app.inject({
      method: 'POST',
      url: '/api/goals',
      headers: { cookie },
      payload: { title: 'Side Project MVP', whyStatement: 'Autonomy' },
    });
    expect(create.statusCode).toBe(200);
    expect(create.json().title).toBe('Side Project MVP');

    const list = await boot1.handle.app.inject({
      method: 'GET',
      url: '/api/goals',
      headers: { cookie },
    });
    expect(list.json().goals).toHaveLength(1);
  });

  it('two users see isolated goals', async () => {
    const cookieA = await login(boot1.handle, 'aa@example.com');
    const cookieB = await login(boot1.handle, 'bb@example.com');

    await boot1.handle.app.inject({
      method: 'POST',
      url: '/api/goals',
      headers: { cookie: cookieA },
      payload: { title: 'Only A sees this' },
    });

    const listA = await boot1.handle.app.inject({
      method: 'GET',
      url: '/api/goals',
      headers: { cookie: cookieA },
    });
    const listB = await boot1.handle.app.inject({
      method: 'GET',
      url: '/api/goals',
      headers: { cookie: cookieB },
    });

    expect(listA.json().goals).toHaveLength(1);
    expect(listB.json().goals).toHaveLength(0);
  });

  it('streams a conversation reply over SSE', async () => {
    const cookie = await login(boot1.handle, 'carol@example.com');
    const conv = await boot1.handle.app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { cookie },
      payload: {},
    });
    const convId = conv.json().id;

    const res = await boot1.handle.app.inject({
      method: 'POST',
      url: `/api/conversations/${convId}/messages`,
      headers: { cookie },
      payload: { content: 'I finished the scope section today.' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('event: user_ack');
    expect(res.body).toContain('event: token');
    expect(res.body).toContain('event: done');
  });

  describe('MCP', () => {
    it('creates a token and uses it to list goals via /mcp', async () => {
      const cookie = await login(boot1.handle, 'dave@example.com');
      // seed a goal via the session
      await boot1.handle.app.inject({
        method: 'POST',
        url: '/api/goals',
        headers: { cookie },
        payload: { title: 'A real goal' },
      });

      // mint an MCP token with only goals:read
      const tokenRes = await boot1.handle.app.inject({
        method: 'POST',
        url: '/api/mcp/tokens',
        headers: { cookie },
        payload: { name: 'Local Claude Code', scopes: ['goals:read'] },
      });
      expect(tokenRes.statusCode).toBe(200);
      const { token } = tokenRes.json();
      expect(typeof token).toBe('string');

      // call /mcp with bearer
      const mcp = await boot1.handle.app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { authorization: `Bearer ${token}` },
        payload: { method: 'list_active_goals' },
      });
      expect(mcp.statusCode).toBe(200);
      expect(mcp.json().goals[0].title).toBe('A real goal');
    });

    it('denies writes when scope is missing', async () => {
      const cookie = await login(boot1.handle, 'erin@example.com');
      const tokenRes = await boot1.handle.app.inject({
        method: 'POST',
        url: '/api/mcp/tokens',
        headers: { cookie },
        payload: { name: 'read-only', scopes: ['goals:read'] },
      });
      const { token } = tokenRes.json();

      const mcp = await boot1.handle.app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { authorization: `Bearer ${token}` },
        payload: { method: 'mark_action_done', params: { actionId: 'doesnt-matter' } },
      });
      expect(mcp.statusCode).toBe(403);
    });

    it('mcp token from user A cannot see user B data', async () => {
      const cookieA = await login(boot1.handle, 'isoA@example.com');
      const cookieB = await login(boot1.handle, 'isoB@example.com');

      await boot1.handle.app.inject({
        method: 'POST',
        url: '/api/goals',
        headers: { cookie: cookieB },
        payload: { title: "B's private goal" },
      });
      const tokenRes = await boot1.handle.app.inject({
        method: 'POST',
        url: '/api/mcp/tokens',
        headers: { cookie: cookieA },
        payload: { name: 'A token', scopes: ['goals:read'] },
      });
      const { token } = tokenRes.json();

      const mcp = await boot1.handle.app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { authorization: `Bearer ${token}` },
        payload: { method: 'list_active_goals' },
      });
      expect(mcp.statusCode).toBe(200);
      expect(mcp.json().goals).toHaveLength(0);
    });

    it('revoked tokens are rejected', async () => {
      const cookie = await login(boot1.handle, 'frank@example.com');
      const tokenRes = await boot1.handle.app.inject({
        method: 'POST',
        url: '/api/mcp/tokens',
        headers: { cookie },
        payload: { name: 'will-revoke', scopes: ['goals:read'] },
      });
      const { id, token } = tokenRes.json();

      await boot1.handle.app.inject({
        method: 'DELETE',
        url: `/api/mcp/tokens/${id}`,
        headers: { cookie },
      });

      const mcp = await boot1.handle.app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { authorization: `Bearer ${token}` },
        payload: { method: 'list_active_goals' },
      });
      expect(mcp.statusCode).toBe(401);
    });
  });
});
