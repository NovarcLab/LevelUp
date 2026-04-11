import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { buildContext } from '@levelup/context';
import { personaEngine, validateResponse } from '@levelup/persona';
import { decideCard } from '@levelup/card';
import type { LLMClient, ChatMessage } from '@levelup/llm';
import type { CardPayload } from '@levelup/shared';
import { requireTenant } from '../plugins.js';
import type { TenantContext } from '@levelup/tenancy';

export async function conversationRoutes(
  app: FastifyInstance,
  deps: { llm: LLMClient },
): Promise<void> {
  app.post('/api/conversations', async (req) => {
    const tenant = requireTenant(req);
    const body = z
      .object({ contextGoalId: z.string().optional() })
      .parse(req.body ?? {});
    const id = nanoid(12);
    const now = Date.now();
    tenant.db
      .prepare(
        `INSERT INTO conversations (id,context_goal_id,started_at,last_msg_at,created_at,source)
         VALUES (?,?,?,?,?,'web')`,
      )
      .run(id, body.contextGoalId ?? null, now, now, now);
    return { id };
  });

  app.get('/api/conversations', async (req) => {
    const tenant = requireTenant(req);
    const rows = tenant.db
      .prepare(
        'SELECT id, started_at, last_msg_at, context_goal_id FROM conversations ORDER BY last_msg_at DESC LIMIT 20',
      )
      .all();
    return { conversations: rows };
  });

  app.get('/api/conversations/:id', async (req) => {
    const tenant = requireTenant(req);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const conv = tenant.db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(id);
    if (!conv) return { error: 'not_found' };
    const messages = tenant.db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at')
      .all(id);
    return { conversation: conv, messages };
  });

  // SSE: send a message and stream the reply.
  app.post('/api/conversations/:id/messages', async (req, reply) => {
    const tenant = requireTenant(req);
    const { id: convId } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ content: z.string().min(1) }).parse(req.body);

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders();

    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Persist user message
    const userMsgId = nanoid(16);
    const now = Date.now();
    const insertMessage = tenant.db.prepare(
      `INSERT INTO messages (id,conversation_id,role,content,embedded_cards,created_at)
       VALUES (?,?,?,?,?,?)`,
    );
    const updateConv = tenant.db.prepare(
      'UPDATE conversations SET last_msg_at = ? WHERE id = ?',
    );
    const tx = tenant.db.transaction(() => {
      insertMessage.run(userMsgId, convId, 'user', body.content, null, now);
      updateConv.run(now, convId);
    });
    tx();
    send('user_ack', { messageId: userMsgId });

    // Build context
    const recentMessages = tenant.db
      .prepare(
        'SELECT role, content FROM messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 10',
      )
      .all(convId) as ChatMessage[];
    recentMessages.reverse();
    // Drop the just-inserted user message from tail (buildContext re-adds it)
    const recentForCtx = recentMessages.slice(0, -1);

    const packet = await buildContext(tenant, {
      conversationId: convId,
      userMessage: body.content,
      recentMessages: recentForCtx,
    });

    // Stream the LLM reply, retry once on validation failure.
    const buffer = { text: '' };
    await streamReply(deps.llm, packet, buffer, send);

    const validation = validateResponse(buffer.text);
    if (!validation.ok) {
      buffer.text = '';
      send('replace', { reason: 'validation', violations: validation.violations });
      const retryPacket = {
        ...packet,
        systemPrompt: `${packet.systemPrompt}\n\n# Important\nYour previous draft used forbidden phrases (${validation.violations
          .map((v) => v.type)
          .join(', ')}). Rewrite without them. Keep meaning, change form.`,
      };
      await streamReply(deps.llm, retryPacket, buffer, send);
    }

    // Decide on a card.
    const cardPayload = await decideCard(tenant, {
      userMessage: body.content,
      intent: packet.meta.intent,
    });
    if (cardPayload) send('card', cardPayload);

    const assistantMsgId = nanoid(16);
    tenant.db
      .prepare(
        `INSERT INTO messages (id,conversation_id,role,content,embedded_cards,created_at)
         VALUES (?,?,?,?,?,?)`,
      )
      .run(
        assistantMsgId,
        convId,
        'assistant',
        buffer.text,
        cardPayload ? JSON.stringify([cardPayload]) : null,
        Date.now(),
      );

    // Lightweight persona calibration signal: if intent was emotional, nudge warmth.
    if (packet.meta.intent === 'emotion') {
      await personaEngine.calibrate(tenant, {
        type: 'emotion_word',
        word: body.content.slice(0, 20),
        intensity: 0.7,
      });
    }

    send('done', { messageId: assistantMsgId });
    reply.raw.end();
    return reply;
  });
}

async function streamReply(
  llm: LLMClient,
  packet: { systemPrompt: string; messages: ChatMessage[] },
  buffer: { text: string },
  send: (event: string, data: unknown) => void,
): Promise<void> {
  for await (const event of llm.stream({
    systemPrompt: packet.systemPrompt,
    messages: packet.messages,
  })) {
    if (event.type === 'token') {
      buffer.text += event.text;
      send('token', { delta: event.text });
    } else if (event.type === 'finish') {
      send('finish', { usage: event.usage });
    } else if (event.type === 'error') {
      send('error', { message: event.error.message, retryable: event.retryable });
      break;
    }
  }
}

// Tiny helper: silence unused warning for TenantContext import
export type _Unused = TenantContext;
