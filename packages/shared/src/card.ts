import { z } from 'zod';

export const CtaSchema = z.object({
  label: z.string(),
  action: z.enum(['open_goal', 'start_retro', 'show_roadmap']),
});

export const ProgressCardSchema = z.object({
  type: z.literal('progress'),
  goalId: z.string(),
  title: z.string(),
  percent: z.number().min(0).max(100),
  nextStep: z.string(),
  cta: CtaSchema.optional(),
});

export const LocateCardSchema = z.object({
  type: z.literal('locate'),
  goalId: z.string(),
  trail: z.array(z.string()),
  currentNode: z.string(),
});

export const StatusCardSchema = z.object({
  type: z.literal('status'),
  goalId: z.string(),
  title: z.string(),
  currentMilestone: z.string(),
  recentAction: z.string(),
});

export const SummaryCardSchema = z.object({
  type: z.literal('summary'),
  goals: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      percent: z.number(),
      headline: z.string(),
    }),
  ),
});

export const EncourageCardSchema = z.object({
  type: z.literal('encourage'),
  doneActions: z.array(
    z.object({ title: z.string(), at: z.string() }),
  ),
  days: z.number().int(),
});

export const CelebrateCardSchema = z.object({
  type: z.literal('celebrate'),
  goalId: z.string(),
  milestoneTitle: z.string(),
  oneLinerQuote: z.string().optional(),
});

export const CardPayloadSchema = z.discriminatedUnion('type', [
  ProgressCardSchema,
  LocateCardSchema,
  StatusCardSchema,
  SummaryCardSchema,
  EncourageCardSchema,
  CelebrateCardSchema,
]);

export type CardPayload = z.infer<typeof CardPayloadSchema>;
