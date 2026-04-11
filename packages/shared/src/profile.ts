import { z } from 'zod';

export const RelationshipSchema = z.object({
  type: z.enum(['partner', 'parent', 'child', 'friend', 'mentor', 'other']),
  name: z.string(),
  since: z.number().int().optional(),
});

export const ProfileSchema = z.object({
  name: z.string(),
  city: z.string().optional(),
  role: z.string().optional(),
  values: z.array(z.string()).default([]),
  relationships: z.array(RelationshipSchema).default([]),
  updatedAt: z.string(),
  about: z.string().default(''),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
