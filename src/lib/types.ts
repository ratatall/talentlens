import { z } from 'zod';
export type Profile = { id: string; name: string; title: string; company: string; location: string; years: number; skills: string[]; summary: string; experience: string[]; source: string };
export const searchSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  mode: z.enum(['keyword', 'hybrid']).default('keyword'),
  requiredSkills: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  prioritySkills: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  minYears: z.number().int().min(0).max(50).default(0),
  excludedIds: z.array(z.string().max(40)).max(500).default([]),
});
export type SearchInput = z.infer<typeof searchSchema>;
export const criteriaSchema = z.object({ requiredSkills: z.array(z.string().min(1).max(60)).max(12), minYears: z.number().int().min(0).max(50), summary: z.string().max(500) });
export type Criteria = z.infer<typeof criteriaSchema>;
export type Match = { profile: Profile; score: number; evidence: { skill: string; excerpt: string; source: string }[]; missing: string[] };
export type SearchResponse = { results: Match[]; total: number; elapsedMs: number; backend: 'demo' | 'opensearch'; method: string; usage: { embeddingTokens: number }; };
