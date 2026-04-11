import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../auth.js';
import { SESSION_COOKIE, requireUser } from '../plugins.js';

const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

export async function authRoutes(app: FastifyInstance, deps: { auth: Auth }): Promise<void> {
  app.post('/api/auth/dev-login', async (req, reply) => {
    const body = z
      .object({ email: z.string().email() })
      .parse(req.body);

    const { user, sessionId } = await deps.auth.createOrLoginUser(body.email);
    reply.setCookie(SESSION_COOKIE, sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: SESSION_MAX_AGE_S,
    });
    return { user: { id: user.id, email: user.email } };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid) deps.auth.destroySession(sid);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req) => {
    const user = requireUser(req);
    return { user: { id: user.id, email: user.email, theme: user.theme, plan: user.plan } };
  });
}
