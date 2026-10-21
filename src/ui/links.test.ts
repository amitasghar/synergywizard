import { describe, expect, it } from "vitest";
import { poe2dbUrl, wikiUrl } from "./links.ts";

describe("outbound links", () => {
  it("builds poe2db page names", () => {
    expect(poe2dbUrl("Shield Wall")).toBe("https://poe2db.tw/us/Shield_Wall");
    expect(poe2dbUrl("Zealot's Oath")).toBe("https://poe2db.tw/us/Zealots_Oath");
    expect(poe2dbUrl("...and Protect me from Harm")).toBe("https://poe2db.tw/us/and_Protect_me_from_Harm");
  });
  it("builds wiki search links", () => {
    expect(wikiUrl("Zealot's Oath")).toBe("https://www.poe2wiki.net/index.php?search=Zealot's%20Oath");
  });
});
