import { z } from 'zod';

/**
 * TenantId identifies one user's isolated workspace. It is equal in value
 * to the user's id in system.db but the type is deliberately separate so
 * business code must go through tenancy.acquire() to reach the data.
 *
 * Format constraints are enforced here AND in tenancy's path resolver.
 */
export const TenantIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, 'tenantId must be 8-64 chars of [A-Za-z0-9_-]')
  .brand<'TenantId'>();

export type TenantId = z.infer<typeof TenantIdSchema>;

export const UserIdSchema = z.string().min(8).brand<'UserId'>();
export type UserId = z.infer<typeof UserIdSchema>;

export const GoalIdSchema = z.string().min(8).brand<'GoalId'>();
export type GoalId = z.infer<typeof GoalIdSchema>;

export const ConversationIdSchema = z.string().min(8).brand<'ConversationId'>();
export type ConversationId = z.infer<typeof ConversationIdSchema>;

export const MessageIdSchema = z.string().min(8).brand<'MessageId'>();
export type MessageId = z.infer<typeof MessageIdSchema>;
