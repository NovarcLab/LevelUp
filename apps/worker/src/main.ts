import path from 'node:path';
import { z } from 'zod';
import pino from 'pino';
import { createTenantRegistry } from '@levelup/tenancy';
import { createAnthropicClient, createFakeLLM } from '@levelup/llm';
import { Scheduler } from './scheduler.js';
import { createDigestWriter } from './jobs/digest-writer.js';
import { createImportanceDecay } from './jobs/importance-decay.js';
import { createWeeklyAggregate } from './jobs/weekly-aggregate.js';
import { createSilenceDetect } from './jobs/silence-detect.js';
import { createBackup } from './jobs/backup.js';
import { createDigestArchive } from './jobs/digest-archive.js';

const EnvSchema = z.object({
  DATA_ROOT: z.string().default('./data'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL_SUMMARY: z.string().default('claude-haiku-4-5-20251001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
});

async function main() {
  const env = EnvSchema.parse(process.env);
  const dataRoot = path.resolve(env.DATA_ROOT);

  const logOpts: pino.LoggerOptions = { level: env.LOG_LEVEL };
  if (env.NODE_ENV === 'development') {
    logOpts.transport = { target: 'pino-pretty', options: { colorize: true } };
  }
  const log = pino(logOpts);

  log.info({ dataRoot }, 'worker starting');

  const registry = createTenantRegistry({ dataRoot });
  const llm = env.ANTHROPIC_API_KEY
    ? createAnthropicClient({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL_SUMMARY,
      })
    : createFakeLLM({ reply: () => '{"topic":"","progress":"","mood":"neutral","openQuestions":[],"aiPromises":[]}' });

  const scheduler = new Scheduler(dataRoot, log);

  // Digest writer: every 60s
  scheduler.register({
    name: 'digest-writer',
    schedule: 60_000,
    run: createDigestWriter(registry, llm, dataRoot, log),
  });

  // Importance decay: Monday 04:00
  scheduler.register({
    name: 'importance-decay',
    schedule: '0 4 * * 1',
    run: createImportanceDecay(registry, dataRoot, log),
  });

  // Weekly aggregate: Sunday 23:00
  scheduler.register({
    name: 'weekly-aggregate',
    schedule: '0 23 * * 0',
    run: createWeeklyAggregate(registry, llm, dataRoot, log),
  });

  // Silence detection: hourly
  scheduler.register({
    name: 'silence-detect',
    schedule: '0 * * * *',
    run: createSilenceDetect(registry, dataRoot, log),
  });

  // Backup: daily 03:00
  scheduler.register({
    name: 'backup',
    schedule: '0 3 * * *',
    run: createBackup(dataRoot, log),
  });

  // Digest archive: monthly 1st at 05:00
  scheduler.register({
    name: 'digest-archive',
    schedule: '0 5 1 * *',
    run: createDigestArchive(dataRoot, log),
  });

  log.info('worker ready — 6 jobs registered');

  // Graceful shutdown
  const shutdown = () => {
    log.info('worker shutting down');
    scheduler.stop();
    registry.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Worker fatal:', err);
  process.exit(1);
});
