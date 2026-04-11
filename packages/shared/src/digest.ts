import { z } from 'zod';

export const MoodSchema = z.enum(['low', 'mid', 'high', 'mixed']);
export type Mood = z.infer<typeof MoodSchema>;

export const SessionDigestSchema = z.object({
  segmentId: z.string(),
  conversationId: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  topic: z.string(),
  progress: z.string(),
  mood: MoodSchema,
  openQuestions: z.array(z.string()).default([]),
  aiPromises: z.array(z.string()).default([]),
  importance: z.number().int().min(0).max(100).default(50),
  deleted: z.boolean().default(false),
});

export type SessionDigest = z.infer<typeof SessionDigestSchema>;

export const TrendReportSchema = z.object({
  isoWeek: z.string(),
  executionPattern: z.string(),
  mostEffectiveTrigger: z.string(),
  mostMissedDay: z.string(),
  emotionalArc: z.string(),
  recurringBlockers: z.array(z.string()).default([]),
});

export type TrendReport = z.infer<typeof TrendReportSchema>;
