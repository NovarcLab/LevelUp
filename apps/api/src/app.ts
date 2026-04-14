import Fastify, { type FastifyInstance } from 'fastify';
import { createTenantRegistry, type TenantRegistry } from '@levelup/tenancy';
import type { LLMClient } from '@levelup/llm';
import { createFakeLLM, createAnthropicClient } from '@levelup/llm';
import { openSystemDb } from './system-db.js';
import { createAuth, type Auth } from './auth.js';
import { installPlugins } from './plugins.js';
import { authRoutes } from './routes/auth.js';
import { goalsRoutes } from './routes/goals.js';
import { conversationRoutes } from './routes/conversations.js';
import { mcpRoutes } from './routes/mcp.js';
import { settingsRoutes } from './routes/settings.js';
import type { Config } from './config.js';

export interface App {
  app: FastifyInstance;
  registry: TenantRegistry;
  auth: Auth;
  close: () => Promise<void>;
}

export async function createApp(config: Config): Promise<App> {
  const systemDb = await openSystemDb(config.systemDbPath);
  const registry = createTenantRegistry({ dataRoot: config.dataRoot });
  const auth = createAuth({ systemDb, registry });

  const llm: LLMClient = config.anthropicApiKey
    ? createAnthropicClient({
        apiKey: config.anthropicApiKey,
        model: config.anthropicModelChat,
        completeModel: config.anthropicModelSummary,
      })
    : createFakeLLM({
        reply: () =>
          "You're moving. Where did you stop? I want to pick it up from exactly there.",
      });

  const app = Fastify({
    logger: config.nodeEnv === 'test' ? false : { level: 'info' },
  });

  await installPlugins(app, { auth, registry });

  app.get('/healthz', async () => {
    let dbMs = -1;
    try {
      const start = performance.now();
      registry.getStats();
      dbMs = Math.round(performance.now() - start);
    } catch { /* ignore */ }

    let diskFreeMb = -1;
    try {
      const { execSync } = await import('node:child_process');
      const df = execSync(`df -m "${config.dataRoot}" | tail -1`).toString();
      const parts = df.trim().split(/\s+/);
      diskFreeMb = parseInt(parts[3] ?? '0', 10);
    } catch { /* ignore */ }

    return {
      status: 'ok',
      ts: Date.now(),
      dbMs,
      diskFreeMb,
      openTenants: registry.getStats().openTenants,
    };
  });

  await authRoutes(app, { auth });
  await goalsRoutes(app);
  await conversationRoutes(app, { llm });
  await mcpRoutes(app, { auth });
  await settingsRoutes(app, { auth });

  return {
    app,
    registry,
    auth,
    close: async () => {
      await app.close();
      await registry.close();
      systemDb.close();
    },
  };
}
