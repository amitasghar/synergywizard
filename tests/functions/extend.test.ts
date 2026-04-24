import { describe, expect, it } from "vitest";
import { extendBodySchema } from "../../netlify/functions/_lib/validators.ts";
import { badRequest, json } from "../../netlify/functions/_lib/response.ts";

describe("extend validation", () => {
  it("rejects empty mechanic_tags", () => {
    const result = extendBodySchema.safeParse({ game: "poe2", mechanic_tags: [] });
    expect(result.success).toBe(false);
  });

  it("accepts valid mechanic_tags", () => {
    const result = extendBodySchema.safeParse({ game: "poe2", mechanic_tags: ["slam", "fire"] });
    expect(result.success).toBe(true);
  });

  it("defaults exclude_ids to empty array", () => {
    const result = extendBodySchema.safeParse({ game: "poe2", mechanic_tags: ["slam"] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.exclude_ids).toEqual([]);
  });

  it("json response has correct content-type", () => {
    const res = json({ skills: [], supports: [], passives: [] });
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });
});
