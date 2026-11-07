import { describe, expect, it } from "vitest";
import { parsePobUnique, pobUniqueEntities } from "./pob.ts";

describe("parsePobUnique", () => {
  it("keeps only the current version's base and stats", () => {
    const raw = [
      "Seeing Stars",
      "{variant:1,2}Plated Mace",
      "{variant:3}Marching Mace",
      "Variant: Pre 0.1.1",
      "Variant: Pre 0.4.0",
      "Variant: Current",
      "{variant:1}Adds (9-12) to (18-22) Cold Damage",
      "{variant:3}Adds (24-31) to (36-46) Cold Damage",
      "{tags:life}+(30-40) to maximum Life",
    ].join("\n");
    expect(parsePobUnique(raw)).toEqual({
      name: "Seeing Stars",
      base: "Marching Mace",
      stats: ["Adds (24-31) to (36-46) Cold Damage", "+(30-40) to maximum Life"],
    });
  });

  it("keeps every alternative when variants are choices, and skips header lines", () => {
    const raw = [
      "Mageblood",
      "Utility Belt",
      "Has Alt Variant: true",
      "Selected Variant: 1",
      "Variant: Legacy of Ruby",
      "Variant: Legacy of Sapphire",
      "League: Runes of Aldur",
      "Implicits: 1",
      "Has (1-3) Charm Slot",
      "{variant:1}Ruby legacy",
      "{variant:2}Sapphire legacy",
    ].join("\n");
    expect(parsePobUnique(raw)).toEqual({
      name: "Mageblood",
      base: "Utility Belt",
      stats: ["Has (1-3) Charm Slot", "Ruby legacy", "Sapphire legacy"],
    });
  });
});

describe("pobUniqueEntities", () => {
  it("builds entries with item class, base, weapon and damage", () => {
    const [e] = pobUniqueEntities([
      { file: "staff", text: "Pillar of the Caged God\nWrapped Quarterstaff\nImplicits: 1\nGrants Skill: Level (1-20) Some Skill\n+20 to Lightning Damage" },
    ]);
    expect(e).toMatchObject({
      id: "unique-pillar-of-the-caged-god",
      kind: "unique",
      itemClass: "Quarterstaff",
      base: "Wrapped Quarterstaff",
      weapons: ["quarterstaff"],
      damage: ["lightning"],
      stats: ["Grants Skill: Level (1-20) Some Skill", "+20 to Lightning Damage"],
    });
  });
});
