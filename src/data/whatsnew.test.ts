import { describe, expect, it } from "vitest";
import { LATEST_NEWS, WHATS_NEW } from "./whatsnew.ts";

describe("What's new", () => {
  it("is newest first with real dates, so the NEW tag uses the latest entry", () => {
    for (const n of WHATS_NEW) expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = WHATS_NEW.map((n) => n.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(LATEST_NEWS).toBe(dates[0]);
  });
});
