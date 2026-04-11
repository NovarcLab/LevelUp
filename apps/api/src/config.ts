import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  DATA_ROOT: z.string().default('./data'),
  API_PORT: z.coerce.number().int().default(4000),
  SESSION_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL_CHAT: z.string().default('claude-sonnet-4-6'),
  ANTHROPIC_MODEL_SUMMARY: z.string().default('claude-haiku-4-5-20251001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = {
  dataRoot: string;
  port: number;
  sessionSecret: string;
  anthropicApiKey: string | undefined;
  anthropicModelChat: string;
  anthropicModelSummary: string;
  nodeEnv: 'development' | 'production' | 'test';
  systemDbPath: string;
};

export function loadConfig(): Config {
  const parsed = EnvSchema.parse(process.env);
  const dataRoot = path.resolve(parsed.DATA_ROOT);
  return {
    dataRoot,
    port: parsed.API_PORT,
    sessionSecret: parsed.SESSION_SECRET,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    anthropicModelChat: parsed.ANTHROPIC_MODEL_CHAT,
    anthropicModelSummary: parsed.ANTHROPIC_MODEL_SUMMARY,
    nodeEnv: parsed.NODE_ENV,
    systemDbPath: path.join(dataRoot, 'system.db'),
  };
}
