import { describe, it, expect } from "vitest";
import { semanticSearchBodySchema } from "../../netlify/functions/_lib/validators.ts";

// Test schema validation directly (same pattern as search.test.ts)
describe("semanticSearchBodySchema", () => {
  it("rejects missing vector", () => {
    const result = semanticSearchBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects vector with wrong dimensions", () => {
    const result = semanticSearchBodySchema.safeParse({ vector: [0.1, 0.2] });
    expect(result.success).toBe(false);
  });

  it("accepts valid 384-dim vector", () => {
    const vec = Array.from({ length: 384 }, () => 0.1);
    const result = semanticSearchBodySchema.safeParse({ vector: vec });
    expect(result.success).toBe(true);
  });

  it("defaults limit to 10", () => {
    const vec = Array.from({ length: 384 }, () => 0.1);
    const result = semanticSearchBodySchema.safeParse({ vector: vec });
    expect(result.success && result.data.limit).toBe(10);
  });
});
