import type { Logger } from 'pino';
import type { TenantRegistry } from '@levelup/tenancy';
import { memoryStore } from '@levelup/memory';
import type { LLMClient } from '@levelup/llm';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const IDLE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

interface ConvRow {
  id: string;
  context_goal_id: string | null;
  started_at: number;
  last_msg_at: number;
}

interface MsgRow {
  role: string;
  content: string;
}

/**
 * Polls for conversations where digest_written=0 and last_msg_at is
 * older than 30 minutes. Summarizes via LLM and writes digest.
 */
export function createDigestWriter(
  registry: TenantRegistry,
  llm: LLMClient,
  dataRoot: string,
  log: Logger,
) {
  const failPath = join(dataRoot, 'digest-failures.jsonl');

  return async function digestWriter(): Promise<void> {
    // List all tenant directories
    const { readdirSync } = await import('node:fs');
    const tenantsDir = join(dataRoot, 'tenants');
    let tenantIds: string[];
    try {
      tenantIds = readdirSync(tenantsDir);
    } catch {
      return; // no tenants yet
    }

    for (const tenantId of tenantIds) {
      let ctx;
      try {
        ctx = await registry.acquire(tenantId);
      } catch {
        continue; // tenant not found or corrupted
      }

      try {
        const cutoff = Date.now() - IDLE_THRESHOLD_MS;
        const pendingConvs = ctx.db
          .prepare(
            `SELECT id, context_goal_id, started_at, last_msg_at
             FROM conversations
             WHERE digest_written = 0 AND last_msg_at < ?
             ORDER BY last_msg_at ASC
             LIMIT 5`,
          )
          .all(cutoff) as ConvRow[];

        for (const conv of pendingConvs) {
          try {
            await processConversation(ctx, conv, llm, log);
          } catch (err) {
            log.error({ tenantId, convId: conv.id, err }, 'digest write failed');
            appendFileSync(
              failPath,
              JSON.stringify({
                tenantId,
                convId: conv.id,
                error: String(err),
                at: new Date().toISOString(),
              }) + '\n',
            );
          }
        }
      } finally {
        registry.release(ctx);
      }
    }
  };
}

async function processConversation(
  ctx: Parameters<typeof memoryStore.appendDigest>[0],
  conv: ConvRow,
  llm: LLMClient,
  log: Logger,
): Promise<void> {
  const messages = (ctx as { db: { prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] } } }).db
    .prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at',
    )
    .all(conv.id) as MsgRow[];

  if (messages.length === 0) {
    // Empty conversation — mark as written, no digest needed
    (ctx as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db
      .prepare('UPDATE conversations SET digest_written = 1 WHERE id = ?')
      .run(conv.id);
    return;
  }

  // Format messages for summarization
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
    .join('\n');

  // Use LLM to generate structured summary
  const summaryPrompt = `Summarize this conversation into a structured session digest.
Extract: about (topic), progress (what was accomplished), mood (single word),
open questions (unresolved), and AI promises (commitments made).
Keep each point to one sentence.

Conversation:
${transcript}

Respond in this exact JSON format:
{"about":"...","progress":"...","mood":"...","openQuestions":["..."],"aiPromises":["..."]}`;

  let summaryText = '';
  for await (const event of llm.stream({
    systemPrompt: 'You are a conversation summarizer. Respond only in valid JSON.',
    messages: [{ role: 'user', content: summaryPrompt }],
  })) {
    if (event.type === 'token') summaryText += event.text;
  }

  // Parse summary (graceful fallback)
  let parsed: {
    topic?: string;
    progress?: string;
    mood?: string;
    openQuestions?: string[];
    aiPromises?: string[];
  };
  try {
    parsed = JSON.parse(summaryText);
  } catch {
    parsed = { topic: transcript.slice(0, 100), mood: 'neutral' };
  }

  const { nanoid } = await import('nanoid');
  const validMoods = ['low', 'mid', 'high', 'mixed'] as const;
  const rawMood = parsed.mood ?? 'mid';
  const mood = validMoods.includes(rawMood as typeof validMoods[number])
    ? (rawMood as typeof validMoods[number])
    : 'mid';

  const digest = {
    segmentId: nanoid(12),
    conversationId: conv.id,
    startedAt: new Date(conv.started_at).toISOString(),
    endedAt: new Date(conv.last_msg_at).toISOString(),
    topic: parsed.topic ?? '',
    progress: parsed.progress ?? '',
    mood,
    openQuestions: parsed.openQuestions ?? [],
    aiPromises: parsed.aiPromises ?? [],
    importance: 50,
    deleted: false,
  };

  await memoryStore.appendDigest(ctx, digest);

  // Mark as written
  (ctx as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db
    .prepare('UPDATE conversations SET digest_written = 1 WHERE id = ?')
    .run(conv.id);

  log.info({ tenantId: ctx.tenantId, convId: conv.id }, 'digest written');
}
