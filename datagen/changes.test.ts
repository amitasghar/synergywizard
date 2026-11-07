import { describe, expect, it } from "vitest";
import type { Entity } from "../src/data/types.ts";
import { makeBaseline, markChanges } from "./changes.ts";

const e = (id: string, stats: string[]): Entity => ({ id, kind: "skill", name: id, text: "", stats, tags: [], damage: [], weapons: [], effects: [] });

describe("markChanges", () => {
  it("marks entries new or changed since the baseline, and clears stale marks", () => {
    const baseline = makeBaseline("0.5", [e("a", ["1"]), e("b", ["1"])]);
    const out = markChanges([{ ...e("a", ["1"]), change: "changed" }, e("b", ["2"]), e("c", ["1"])], baseline);
    expect(out.map((x) => x.change)).toEqual([undefined, "changed", "new"]);
  });
});
