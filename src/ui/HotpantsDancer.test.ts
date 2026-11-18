import { describe, expect, it } from "vitest";
import { hasHotpants } from "./HotpantsDancer.tsx";

describe("hotpants easter egg", () => {
  it("triggers on hotpants / hotpant in any case or position", () => {
    for (const q of ["hotpants", "Hotpant", "fire skills HOTPANTS", "hot pants", "my hotpants build"]) expect(hasHotpants(q)).toBe(true);
  });
  it("ignores other words", () => {
    for (const q of ["", "hot", "pants", "hotpantsuit", "shotpants", "heal myself quickly"]) expect(hasHotpants(q)).toBe(false);
  });
});
