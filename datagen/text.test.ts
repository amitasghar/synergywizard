import { describe, expect, it } from "vitest";
import { buildTranslationIndex, cleanMarkup, translateStats, type Translation } from "./text.ts";

describe("cleanMarkup", () => {
  it("keeps the display half of [Id|Text] and unwraps [Text]", () => {
    expect(cleanMarkup("[Stun|Stunning] enemies with [Fire]")).toBe("Stunning enemies with Fire");
  });
});

const tr = (ids: string[], string: string, format: string[], handlers: string[][] = ids.map(() => []), condition = ids.map(() => ({}))): Translation => ({
  ids,
  English: [{ condition, format, index_handlers: handlers, string }],
});

describe("translateStats", () => {
  it("fills placeholders and strips markup", () => {
    const index = buildTranslationIndex([tr(["base_strength"], "{0} to [Strength]", ["+#"])]);
    expect(translateStats({ base_strength: 8 }, index)).toEqual(["+8 to Strength"]);
  });

  it("applies index handlers", () => {
    const index = buildTranslationIndex([tr(["buff_ms"], "Lasts {0} seconds", ["#"], [["milliseconds_to_seconds"]])]);
    expect(translateStats({ buff_ms: 4000 }, index)).toEqual(["Lasts 4 seconds"]);
  });

  it("picks the variant whose condition matches", () => {
    const index = buildTranslationIndex([
      {
        ids: ["dmg_+%"],
        English: [
          { condition: [{ min: 1 }], format: ["#"], index_handlers: [[]], string: "{0}% increased Damage" },
          { condition: [{ max: -1 }], format: ["#"], index_handlers: [["negate"]], string: "{0}% reduced Damage" },
        ],
      },
    ]);
    expect(translateStats({ "dmg_+%": -10 }, index)).toEqual(["10% reduced Damage"]);
  });

  it("translates a multi-stat line once", () => {
    const index = buildTranslationIndex([tr(["min", "max"], "Adds {0} to {1} Fire Damage", ["#", "#"])]);
    expect(translateStats({ min: 2, max: 5 }, index)).toEqual(["Adds 2 to 5 Fire Damage"]);
  });

  it("drops stats it has no translation for", () => {
    expect(translateStats({ unknown_stat: 1 }, buildTranslationIndex([]))).toEqual([]);
  });

  it("prefers earlier files", () => {
    const index = buildTranslationIndex([tr(["s"], "passive wording", [])], [tr(["s"], "general wording", [])]);
    expect(translateStats({ s: 1 }, index)).toEqual(["passive wording"]);
  });
});
