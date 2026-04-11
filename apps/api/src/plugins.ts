import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cookiePlugin from '@fastify/cookie';
import type { Auth, AuthUser } from './auth.js';
import type { TenantContext, TenantRegistry } from '@levelup/tenancy';
import { UnauthorizedError, LevelUpError } from '@levelup/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser | undefined;
    tenant?: TenantContext | undefined;
    mcpScopes?: string[] | undefined;
  }
}

const SESSION_COOKIE = 'levelup_session';

export interface AppDeps {
  auth: Auth;
  registry: TenantRegistry;
}

/**
 * Install core Fastify plugins: cookies, auth (either session or MCP token),
 * tenant acquire/release, and a unified error translator.
 */
export async function installPlugins(app: FastifyInstance, deps: AppDeps): Promise<void> {
  await app.register(cookiePlugin);

  app.addHook('preHandler', async (req) => {
    // 1. Session cookie
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (sessionId) {
      const user = deps.auth.getSession(sessionId);
      if (user) req.user = user;
    }

    // 2. MCP bearer token (only used if no session and Authorization present)
    if (!req.user) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const raw = authHeader.slice('Bearer '.length).trim();
        try {
          const verified = deps.auth.verifyMcpToken(raw);
          req.user = verified.user;
          req.mcpScopes = verified.scopes;
        } catch {
          /* fall through; handlers can still require auth */
        }
      }
    }

    // 3. Acquire tenant if we know who the user is
    if (req.user) {
      req.tenant = await deps.registry.acquire(req.user.id);
    }
  });

  app.addHook('onResponse', async (req) => {
    if (req.tenant) {
      deps.registry.release(req.tenant);
      req.tenant = undefined;
    }
  });

  app.setErrorHandler((err: unknown, _req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof LevelUpError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    }
    const anyErr = err as { statusCode?: number; message?: string };
    const status = anyErr.statusCode ?? 500;
    return reply.status(status).send({ error: 'internal_error', message: anyErr.message ?? 'error' });
  });
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export function requireTenant(req: FastifyRequest): TenantContext {
  if (!req.tenant) throw new UnauthorizedError();
  return req.tenant;
}

export { SESSION_COOKIE };
