import { describe, expect, it } from "vitest";
import type { Entity } from "../src/data/types.ts";
import { checkSanity } from "./sanity.ts";

const make = (kind: Entity["kind"], n: number): Entity[] =>
  Array.from({ length: n }, (_, i) => ({ id: kind + i, kind, name: kind + i, text: "t", stats: [], tags: [], damage: [], weapons: [], effects: [] }));

const full = (): Entity[] => [
  ...make("skill", 250),
  ...make("support", 350),
  ...make("notable", 600),
  ...make("keystone", 20),
  ...make("ascendancy", 120),
];

describe("checkSanity", () => {
  it("accepts a dataset that meets the minimums and matches the previous one", () => {
    const data = full();
    expect(checkSanity(data, data)).toEqual([]);
  });

  it("reports a shrink of more than 15%", () => {
    const previous = full();
    const next = previous.slice(0, Math.floor(previous.length * 0.8));
    expect(checkSanity(previous, next).some((p) => p.includes("fell from"))).toBe(true);
  });

  it("reports a missing kind as both a minimum and a missing-kind problem", () => {
    const previous = full();
    const next = previous.filter((e) => e.kind !== "keystone");
    const problems = checkSanity(previous, next);
    expect(problems.some((p) => p.includes("only 0 keystone entries"))).toBe(true);
    expect(problems.some((p) => p.includes("no keystone entries any more"))).toBe(true);
  });

  it("reports more than 5% empty entries", () => {
    const next = full().map((e, i) => (i < 100 ? { ...e, text: "", stats: [] } : e));
    expect(checkSanity(null, next).some((p) => p.includes("no description or stats"))).toBe(true);
  });
});
