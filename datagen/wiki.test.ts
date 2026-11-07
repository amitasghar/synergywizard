import { describe, expect, it } from "vitest";
import { uniqueEntities, wikiLines, type WikiUnique } from "./wiki.ts";

const row = (over: Partial<WikiUnique>): WikiUnique => ({ page: "X", name: "X", class: "Ring", in_game: "1", ...over });

describe("wikiLines", () => {
  it("strips links and splits on <br>", () => {
    expect(wikiLines("+3 to Level of all [[Spell]] Skills&lt;br&gt;Skills from [[Corrupted]] Gems have Mana Costs [[Stat conversion|Converted]]")).toEqual([
      "+3 to Level of all Spell Skills",
      "Skills from Corrupted Gems have Mana Costs Converted",
    ]);
  });

  it("flattens random-modifier tables but keeps the <n random …> header", () => {
    const raw =
      '&lt;table class=&quot;random-modifier-stats&quot;&gt;&lt;tr&gt;&lt;th&gt;&lt;2 random radius jewel modifiers&gt;&lt;/th&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;+(2-3)% to [[Chaos Resistance]]&lt;hr style=&quot;width: 20%&quot;&gt;+(2-4)% to [[Cold Resistance]]&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;';
    expect(wikiLines(raw)).toEqual(["<2 random radius jewel modifiers>", "+(2-3)% to Chaos Resistance", "+(2-4)% to Cold Resistance"]);
  });
});

describe("uniqueEntities", () => {
  it("builds entries, skipping removed, out-of-game and non-character items", () => {
    const out = uniqueEntities([
      row({ name: "Adonia&#039;s Ego", page: "Adonia&#039;s Ego", class: "Wand", explicit: "+3 to Level of all [[Spell]] Skills&lt;br&gt;Adds Cold Damage" }),
      row({ name: "Gone", explicit: "x", removal: "0.2.0" }),
      row({ name: "Hidden", explicit: "x", in_game: "0" }),
      row({ name: "Map Thing", class: "Tablet", explicit: "x" }),
      row({ name: "Adonia&#039;s Ego", class: "Wand", explicit: "variant" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "unique-adonia-s-ego",
      kind: "unique",
      name: "Adonia's Ego",
      page: "Adonia's Ego",
      itemClass: "Wand",
      weapons: ["wand"],
      damage: ["cold"],
      stats: ["+3 to Level of all Spell Skills", "Adds Cold Damage"],
    });
  });
});
