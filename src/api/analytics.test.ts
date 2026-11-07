import { describe, expect, it } from "vitest";
import { consentRequired } from "./analytics.ts";

describe("consentRequired", () => {
  it("asks first in the EU, EEA, UK and Switzerland", () => {
    expect(consentRequired({ timeZone: "Europe/Berlin", language: "en-US" })).toBe(true);
    expect(consentRequired({ timeZone: "America/New_York", language: "en-GB" })).toBe(true);
    expect(consentRequired({ timeZone: "Asia/Dhaka", language: "de-CH" })).toBe(true);
  });

  it("doesn't ask elsewhere", () => {
    expect(consentRequired({ timeZone: "America/New_York", language: "en-US" })).toBe(false);
    expect(consentRequired({ timeZone: "Asia/Dhaka", language: "bn" })).toBe(false);
    expect(consentRequired({})).toBe(false);
  });
});
