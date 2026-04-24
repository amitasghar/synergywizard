import { describe, expect, it } from "vitest";
import { analyzeBodySchema, extendBodySchema, searchQuerySchema } from "../../netlify/functions/_lib/validators.ts";

describe("validators", () => {
  it("accepts a well-formed search query", () => {
    const parsed = searchQuerySchema.parse({ game: "poe2", q: "volcanic" });
    expect(parsed.q).toBe("volcanic");
  });

  it("rejects unknown game", () => {
    expect(() => searchQuerySchema.parse({ game: "d4" })).toThrow();
  });

  it("requires at least one entity_id for analyze", () => {
    expect(() => analyzeBodySchema.parse({ game: "poe2", entity_ids: [] })).toThrow();
  });

  it("caps entity_ids at 8", () => {
    const nine = Array.from({ length: 9 }, () => "00000000-0000-0000-0000-000000000000");
    expect(() => analyzeBodySchema.parse({ game: "poe2", entity_ids: nine })).toThrow();
  });

  it("extend defaults exclude_ids to empty array", () => {
    const parsed = extendBodySchema.parse({ game: "poe2", mechanic_tags: ["slam"] });
    expect(parsed.exclude_ids).toEqual([]);
  });
});
