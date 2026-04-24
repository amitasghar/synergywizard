import { describe, expect, it, vi, beforeEach } from "vitest";
import { badRequest, json } from "../../netlify/functions/_lib/response.ts";
import { searchQuerySchema } from "../../netlify/functions/_lib/validators.ts";

// Unit tests for the search function's validation + response logic.
// We test the handler indirectly since it requires a live DB for the SQL path.

describe("search validation", () => {
  it("searchQuerySchema rejects missing game", () => {
    const result = searchQuerySchema.safeParse({ q: "volcanic" });
    expect(result.success).toBe(false);
  });

  it("searchQuerySchema accepts game + q", () => {
    const result = searchQuerySchema.safeParse({ game: "poe2", q: "volcanic" });
    expect(result.success).toBe(true);
  });

  it("json helper sets cache header", () => {
    const res = json({ ok: true });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });

  it("badRequest returns 400 with no cache", () => {
    const res = badRequest("bad");
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });
});
