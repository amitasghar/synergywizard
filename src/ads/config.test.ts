import { describe, expect, it } from "vitest";
import { readAdConfig } from "./config.ts";

const client = "ca-pub-1234567890123456";

describe("readAdConfig", () => {
  it("returns config for a valid client and slots", () => {
    expect(readAdConfig({ VITE_ADSENSE_CLIENT: client, VITE_ADSENSE_SLOT_INLINE: "111", VITE_ADSENSE_SLOT_BOTTOM: "222" })).toEqual({
      client,
      inlineSlot: "111",
      bottomSlot: "222",
    });
  });
  it("accepts a single slot", () => {
    expect(readAdConfig({ VITE_ADSENSE_CLIENT: client, VITE_ADSENSE_SLOT_BOTTOM: "222" })).toEqual({ client, inlineSlot: null, bottomSlot: "222" });
  });
  it("returns null when nothing is set", () => {
    expect(readAdConfig({})).toBeNull();
  });
  it("returns null for a malformed client", () => {
    expect(readAdConfig({ VITE_ADSENSE_CLIENT: "ca-pub-123", VITE_ADSENSE_SLOT_INLINE: "111" })).toBeNull();
    expect(readAdConfig({ VITE_ADSENSE_CLIENT: "pub-1234567890123456", VITE_ADSENSE_SLOT_INLINE: "111" })).toBeNull();
  });
  it("returns null when there are no valid slots", () => {
    expect(readAdConfig({ VITE_ADSENSE_CLIENT: client })).toBeNull();
    expect(readAdConfig({ VITE_ADSENSE_CLIENT: client, VITE_ADSENSE_SLOT_INLINE: "abc", VITE_ADSENSE_SLOT_BOTTOM: "" })).toBeNull();
  });
});
