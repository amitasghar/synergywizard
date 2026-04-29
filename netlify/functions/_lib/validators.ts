import { z } from "zod";

export const gameSchema = z.enum(["poe2"]);

export const searchQuerySchema = z.object({
  game: gameSchema,
  q: z.string().trim().min(1).max(100).optional(),
  // Legacy single-value params kept for URL hydration compat — new UI uses array params below.
  type: z.enum(["skill", "support", "passive"]).optional(),
  weapon: z.string().trim().min(1).max(40).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  // Multi-value params: comma-separated tag lists, e.g. "fire,cold"
  damages: z.string().trim().max(200).optional(),
  mechanics: z.string().trim().max(200).optional(),
  weapons: z.string().trim().max(200).optional(),
  types: z.string().trim().max(200).optional(),
});

export const analyzeBodySchema = z.object({
  game: gameSchema,
  entity_ids: z.array(z.string().uuid()).min(1).max(8),
});

export const extendBodySchema = z.object({
  game: gameSchema,
  mechanic_tags: z.array(z.string().min(1).max(40)).min(1).max(20),
  exclude_ids: z.array(z.string().uuid()).max(8).default([]),
});

export const semanticSearchBodySchema = z.object({
  vector: z.array(z.number()).min(1).max(1024),
  limit: z.number().int().min(1).max(20).default(10),
});
