import { z } from 'zod';

export const GoalStatusSchema = z.enum(['active', 'paused', 'completed', 'archived']);
export const MilestoneStatusSchema = z.enum(['pending', 'in_progress', 'done']);
export const ActionStatusSchema = z.enum(['pending', 'in_progress', 'done', 'skipped']);
export const DerivedStatusSchema = z.enum(['active', 'at-risk', 'stuck', 'near-done']);

export type GoalStatus = z.infer<typeof GoalStatusSchema>;
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;
export type ActionStatus = z.infer<typeof ActionStatusSchema>;
export type DerivedStatus = z.infer<typeof DerivedStatusSchema>;

export const ImplementationIntentionSchema = z.object({
  id: z.string(),
  actionId: z.string(),
  trigger: z.string(),
  behavior: z.string(),
  termination: z.string(),
  fallback: z.string().optional(),
  status: z.enum(['active', 'retired']),
  successCount: z.number().int().default(0),
  failCount: z.number().int().default(0),
});

export const ActionSchema = z.object({
  id: z.string(),
  milestoneId: z.string(),
  title: z.string(),
  weekOf: z.string(),
  status: ActionStatusSchema,
  completedAt: z.number().int().nullable(),
});

export const MilestoneSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  title: z.string(),
  targetWeekIndex: z.number().int().nullable(),
  displayOrder: z.number().int(),
  status: MilestoneStatusSchema,
  completedAt: z.number().int().nullable(),
});

export const GoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  whyStatement: z.string().nullable(),
  targetCompletionDate: z.number().int().nullable(),
  status: GoalStatusSchema,
  displayOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const GoalSnapshotSchema = z.object({
  id: z.string(),
  title: z.string(),
  percent: z.number().min(0).max(100),
  derivedStatus: DerivedStatusSchema,
  currentMilestone: z.string().nullable(),
  updatedAt: z.number().int(),
});

export type Goal = z.infer<typeof GoalSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type ImplementationIntention = z.infer<typeof ImplementationIntentionSchema>;
export type GoalSnapshot = z.infer<typeof GoalSnapshotSchema>;

export interface GoalWithTree extends Goal {
  milestones: (Milestone & { actions: (Action & { intention: ImplementationIntention | null })[] })[];
}
