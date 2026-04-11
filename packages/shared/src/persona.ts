import { z } from 'zod';

export const SoulDimensionsSchema = z.object({
  warmth: z.number().int().min(0).max(100).default(60),
  directness: z.number().int().min(0).max(100).default(55),
  pacing: z.number().int().min(0).max(100).default(50),
});

export const CalibrationEntrySchema = z.object({
  at: z.string(),
  delta: z.object({
    warmth: z.number().int().optional(),
    directness: z.number().int().optional(),
    pacing: z.number().int().optional(),
  }),
  reason: z.string(),
});

export const SoulFrontmatterSchema = SoulDimensionsSchema.extend({
  version: z.number().int().default(1),
  lastCalibrated: z.string().optional(),
  calibrationLog: z.array(CalibrationEntrySchema).default([]),
});

export const SoulSchema = z.object({
  frontmatter: SoulFrontmatterSchema,
  aboutMd: z.string(),
});

export type SoulDimensions = z.infer<typeof SoulDimensionsSchema>;
export type CalibrationEntry = z.infer<typeof CalibrationEntrySchema>;
export type SoulFrontmatter = z.infer<typeof SoulFrontmatterSchema>;
export type Soul = z.infer<typeof SoulSchema>;

export type PersonaSignal =
  | { type: 'emotion_word'; word: string; intensity: number }
  | { type: 'long_silence'; days: number }
  | { type: 'user_pushback'; phrase: string }
  | { type: 'user_warmth_request'; phrase: string }
  | { type: 'missed_action_streak'; count: number };

export type Intent =
  | 'progress_report'
  | 'emotion'
  | 'goal_query'
  | 'new_goal'
  | 'retro_request'
  | 'goal_adjust'
  | 'small_talk';
