import { z } from "zod";

export const gameSchema = z.enum(["poe2"]);

export const searchQuerySchema = z.object({
  game: gameSchema,
  q: z.string().trim().min(1).max(100).optional(),
  class: z.string().trim().min(1).max(40).optional(),
  type: z.enum(["skill", "support", "passive"]).optional(),
  tag: z.string().trim().min(1).max(40).optional(),
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
  vector: z.array(z.number()).length(384),
  limit: z.number().int().min(1).max(20).default(10),
});
