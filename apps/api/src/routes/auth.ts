import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Auth } from '../auth.js';
import { SESSION_COOKIE, requireUser } from '../plugins.js';

const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
const RENEWAL_THRESHOLD_MS = 7 * 24 * 3600 * 1000; // renew if <7 days left
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

// In-memory magic link store (production would use Redis or DB)
const pendingLinks = new Map<string, { email: string; expiresAt: number }>();

export async function authRoutes(app: FastifyInstance, deps: { auth: Auth }): Promise<void> {
  // Dev login (kept for local development)
  app.post('/api/auth/dev-login', async (req, reply) => {
    const body = z
      .object({ email: z.string().email() })
      .parse(req.body);

    const { user, sessionId } = await deps.auth.createOrLoginUser(body.email);
    setSessionCookie(reply, sessionId);
    return { user: { id: user.id, email: user.email } };
  });

  // Magic link: request
  app.post('/api/auth/magic-link', async (req) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const token = crypto.randomBytes(32).toString('hex');
    pendingLinks.set(token, {
      email: body.email,
      expiresAt: Date.now() + MAGIC_LINK_TTL_MS,
    });

    // In production, send email with link containing token.
    // For now, log it (dev mode).
    app.log.info({ email: body.email, token }, 'magic link generated');

    return { ok: true, message: 'Check your email for the login link.' };
  });

  // Magic link: verify
  app.get('/api/auth/verify', async (req, reply) => {
    const query = z.object({ token: z.string() }).parse(req.query);
    const pending = pendingLinks.get(query.token);

    if (!pending || pending.expiresAt < Date.now()) {
      pendingLinks.delete(query.token);
      return reply.status(400).send({ error: 'invalid_or_expired_token' });
    }

    pendingLinks.delete(query.token);
    const { user, sessionId } = await deps.auth.createOrLoginUser(pending.email);
    setSessionCookie(reply, sessionId);
    return { user: { id: user.id, email: user.email } };
  });

  // Google OAuth: initiate (placeholder — needs GOOGLE_CLIENT_ID env)
  app.get('/api/auth/google', async (req, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return reply.status(501).send({ error: 'google_oauth_not_configured' });
    }
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    // Store state+nonce in cookie for CSRF protection
    reply.setCookie('oauth_state', `${state}:${nonce}`, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 600,
    });

    const redirectUri = `${process.env.PUBLIC_URL ?? 'http://localhost:3000'}/api/auth/google/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);

    return reply.redirect(url.toString());
  });

  // Google OAuth: callback
  app.get('/api/auth/google/callback', async (req, reply) => {
    const query = z.object({ code: z.string(), state: z.string() }).parse(req.query);
    const savedState = req.cookies?.oauth_state?.split(':')[0];

    if (query.state !== savedState) {
      return reply.status(403).send({ error: 'invalid_state' });
    }

    reply.clearCookie('oauth_state', { path: '/' });

    // Exchange code for tokens (simplified — production needs full OAuth2 flow)
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return reply.status(501).send({ error: 'google_oauth_not_configured' });
    }

    const redirectUri = `${process.env.PUBLIC_URL ?? 'http://localhost:3000'}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: query.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return reply.status(400).send({ error: 'token_exchange_failed' });
    }

    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) {
      return reply.status(400).send({ error: 'no_id_token' });
    }

    // Decode JWT payload (we trust Google's signature in this context)
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1]!, 'base64url').toString(),
    ) as { email?: string };

    if (!payload.email) {
      return reply.status(400).send({ error: 'no_email_in_token' });
    }

    const { user, sessionId } = await deps.auth.createOrLoginUser(payload.email);
    setSessionCookie(reply, sessionId);

    // Redirect to app
    return reply.redirect('/');
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid) deps.auth.destroySession(sid);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req, reply) => {
    const user = requireUser(req);

    // Session rolling renewal: if <7 days left, extend
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid) {
      deps.auth.renewSessionIfNeeded(sid, RENEWAL_THRESHOLD_MS);
    }

    return { user: { id: user.id, email: user.email, theme: user.theme, plan: user.plan } };
  });
}

function setSessionCookie(reply: { setCookie: Function }, sessionId: string) {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_MAX_AGE_S,
  });
}
