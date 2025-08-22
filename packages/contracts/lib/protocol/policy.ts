import { z } from 'zod';

export const pageFeaturesSchema = z.object({
  host: z.string().min(1),
  path: z.string().default('/'),
  title: z.string().default(''),
  summary: z.string().optional(),
  hints: z
    .object({
      isSearchPage: z.boolean().optional(),
      isFeedLike: z.boolean().optional(),
    })
    .optional(),
});

export type PageFeatures = z.infer<typeof pageFeaturesSchema>;

export const classifierResultSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  label: z.enum(['distract', 'neutral', 'work']),
  confidence: z.number().min(0).max(1).default(0.5),
  rationale: z.string().optional(),
});

export type ClassifierResult = z.infer<typeof classifierResultSchema>;

export const policyDecisionSchema = z.object({
  action: z.enum(['allow', 'block', 'promptAppeal']),
  reason: z.string().default(''),
  ttlMs: z.number().int().positive().optional(),
  // Future extensions guarded by plan's Feature additions (aligned)
  mode: z.enum(['full', 'searchOnly', 'minimal']).optional(),
  friction: z.enum(['low', 'medium', 'high']).optional(),
  budgetState: z
    .object({
      remainingMinutes: z.number().int().nonnegative(),
    })
    .optional(),
  requireIntent: z.boolean().optional(),
  intentTtlMs: z.number().int().positive().optional(),
});

export type PolicyDecision = z.infer<typeof policyDecisionSchema>;

export const policySchemas = {
  pageFeaturesSchema,
  classifierResultSchema,
  policyDecisionSchema,
};
