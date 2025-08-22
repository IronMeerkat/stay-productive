import { z } from 'zod';

export const appealTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

export type AppealTurn = z.infer<typeof appealTurnSchema>;

export const appealDecisionSchema = z.object({
  assistant: z.string().default(''),
  allow: z.boolean().default(false),
  minutes: z.number().int().min(0).max(30).default(0),
});

export type AppealDecision = z.infer<typeof appealDecisionSchema>;

export const intentRecordSchema = z.object({
  text: z.string().min(3).max(200),
  createdAt: z.number().int().nonnegative(),
  ttlMs: z.number().int().positive(),
  host: z.string().min(1),
});

export type IntentRecord = z.infer<typeof intentRecordSchema>;

export const appealMemoryEntrySchema = z.object({
  host: z.string().min(1),
  topic: z.string().optional(),
  justification: z.string().max(500),
  minutesGranted: z.number().int().min(5).max(30),
  timestamp: z.number().int().nonnegative(),
});

export type AppealMemoryEntry = z.infer<typeof appealMemoryEntrySchema>;

export const appealSchemas = {
  appealTurnSchema,
  appealDecisionSchema,
  intentRecordSchema,
  appealMemoryEntrySchema,
};
