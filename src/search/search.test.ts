import { describe, expect, it } from "vitest";
import type { Dataset, Entity } from "../data/types.ts";
import { effectsForQuery, effectsForText } from "../data/effects.ts";
import { buildIndex, emptyFilters, search } from "./search.ts";
import { readUrl, writeUrl } from "./url.ts";

const entity = (over: Partial<Entity>): Entity => ({
  id: over.name ?? "x",
  kind: "skill",
  name: "x",
  text: "",
  stats: [],
  tags: [],
  damage: [],
  weapons: [],
  effects: [],
  ...over,
});

const dataset: Dataset = {
  game: "poe2",
  version: "0.0.0",
  sourceUpdated: "2026-01-01T00:00:00Z",
  builtAt: "2026-01-01T00:00:00Z",
  dims: 2,
  entities: [
    entity({ name: "Fireball", text: "Launch a ball of fire", damage: ["fire"], effects: [] }),
    entity({ name: "Shield Wall", text: "Raise a wall that blocks for 4 seconds", effects: ["defense", "temporary"] }),
    entity({ name: "Iron Skin", kind: "notable", stats: ["20% increased Armour"], effects: ["defense"] }),
  ],
};

describe("effects", () => {
  it("tags descriptions", () => {
    expect(effectsForText("Gain Guard for 4 seconds")).toEqual(expect.arrayContaining(["defense", "temporary"]));
  });
  it("does not call stun threshold crowd control", () => {
    expect(effectsForText("Gain additional Stun Threshold")).not.toContain("control");
    expect(effectsForText("Your hits Stun enemies")).toContain("control");
  });
  it("reads intent from plain-English queries", () => {
    expect(effectsForQuery("protect me for a few seconds")).toEqual(["defense", "temporary"]);
  });
});

describe("search", () => {
  const index = buildIndex(dataset, null);

  it("returns everything in data order with no query", () => {
    expect(search(index, { query: "", filters: emptyFilters() }).hits.map((h) => h.entity.name)).toEqual(["Fireball", "Shield Wall", "Iron Skin"]);
  });

  it("ranks by intent when words do not match names", () => {
    const names = search(index, { query: "a skill that protects me for a few seconds", filters: emptyFilters() }).hits.map((h) => h.entity.name);
    expect(names[0]).toBe("Shield Wall");
    expect(names).not.toContain("Fireball");
  });

  it("ranks exact name matches first", () => {
    expect(search(index, { query: "fireball", filters: emptyFilters() }).hits[0].entity.name).toBe("Fireball");
  });

  it("filters OR within a group and AND across groups", () => {
    const f = { ...emptyFilters(), kinds: ["skill" as const], effects: ["defense"] };
    expect(search(index, { query: "", filters: f }).hits.map((h) => h.entity.name)).toEqual(["Shield Wall"]);
  });

  it("blends in embedding similarity when a query vector is given", () => {
    const vectors = new Int8Array([127, 0, 0, 127, 0, 127]);
    const idx = buildIndex(dataset, vectors);
    const hits = search(idx, { query: "zzz", filters: emptyFilters(), queryVector: [1, 0] }).hits;
    expect(hits[0].entity.name).toBe("Fireball");
  });
});

describe("url state", () => {
  it("round-trips query and filters", () => {
    const f = { ...emptyFilters(), effects: ["defense", "temporary"], damage: ["cold"] };
    const qs = writeUrl("protect me", f);
    expect(readUrl(qs)).toEqual({ query: "protect me", filters: f });
  });
});
