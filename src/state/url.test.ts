import { describe, expect, it } from "vitest";
import { decodeStateFromUrl, encodeStateToUrl } from "./url.ts";

describe("url state", () => {
  it("encodes slugs and conversion", () => {
    const url = encodeStateToUrl("https://example.test/poe2/", {
      slugs: ["volcanic-fissure", "stampede"],
      conversion: { slug: "volcanic-fissure", from: "fire", to: "lightning" },
    });
    expect(url).toContain("skills=volcanic-fissure%2Cstampede");
    expect(url).toContain("convert=volcanic-fissure%3Afire%3Elightning");
  });

  it("decodes slugs and conversion", () => {
    const url = "https://example.test/poe2/?skills=volcanic-fissure,stampede&convert=volcanic-fissure:fire%3Elightning";
    const state = decodeStateFromUrl(url);
    expect(state.slugs).toEqual(["volcanic-fissure", "stampede"]);
    expect(state.conversion).toEqual({ slug: "volcanic-fissure", from: "fire", to: "lightning" });
  });

  it("handles empty state", () => {
    const state = decodeStateFromUrl("https://example.test/poe2/");
    expect(state.slugs).toEqual([]);
    expect(state.conversion).toBeNull();
  });
});
