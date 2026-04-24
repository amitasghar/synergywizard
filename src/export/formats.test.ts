import { describe, expect, it } from "vitest";
import { toMarkdown, toPlainText, toJson } from "./formats.ts";
import type { AnalysisResult } from "../types.ts";

const fixture: AnalysisResult = {
  direct_interactions: [
    { from_entity_id: "a", to_entity_id: "b", interaction_type: "direct", reason: "x" },
  ],
  extended_interactions: [],
  loop_detected: false,
  damage_tags: ["fire"],
  recommended_supports: ["upheaval"],
  relevant_passives: ["aftershocks"],
  conversion_options: [],
  entities: [
    { id: "a", entity_type: "skill", entity_slug: "a", display_name: "A", class_tags: [], mechanic_tags: ["slam"], damage_tags: ["fire"] },
    { id: "b", entity_type: "skill", entity_slug: "b", display_name: "B", class_tags: [], mechanic_tags: ["slam"], damage_tags: ["fire"] },
  ],
};

describe("exports", () => {
  it("markdown contains headings", () => {
    const md = toMarkdown(fixture);
    expect(md).toMatch(/^# Synergy Wizard/m);
    expect(md).toContain("## Direct Interactions");
  });
  it("plain text is non-empty", () => {
    expect(toPlainText(fixture).length).toBeGreaterThan(10);
  });
  it("json roundtrips", () => {
    const parsed = JSON.parse(toJson(fixture));
    expect(parsed.direct_interactions.length).toBe(1);
  });
});
