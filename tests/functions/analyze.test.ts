import { describe, expect, it } from "vitest";
import { analyzeBodySchema } from "../../netlify/functions/_lib/validators.ts";
import { badRequest } from "../../netlify/functions/_lib/response.ts";

describe("analyze validation", () => {
  it("rejects empty entity_ids", () => {
    const result = analyzeBodySchema.safeParse({ game: "poe2", entity_ids: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 8 entity_ids", () => {
    const nine = Array.from({ length: 9 }, () => "00000000-0000-0000-0000-000000000000");
    const result = analyzeBodySchema.safeParse({ game: "poe2", entity_ids: nine });
    expect(result.success).toBe(false);
  });

  it("accepts 2 valid UUIDs", () => {
    const result = analyzeBodySchema.safeParse({
      game: "poe2",
      entity_ids: [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("badRequest returns 400", () => {
    const res = badRequest("bad input");
    expect(res.status).toBe(400);
  });
});
