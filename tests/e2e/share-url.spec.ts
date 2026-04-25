import { expect, test } from "@playwright/test";
import { seedOnce } from "./_seed.ts";

test("share URL round-trip restores the same two skills in tray", async ({ page, context }) => {
  await seedOnce();

  await page.goto("/");
  await page.getByTestId("tab-search").click();
  await page.getByPlaceholder(/search/i).fill("volcanic");
  await page.getByRole("button", { name: /Add Volcanic Fissure/i }).click();
  await page.getByPlaceholder(/search/i).fill("stampede");
  await page.getByRole("button", { name: /Add Stampede/i }).click();
  await page.getByTestId("analyze-button").click();
  await expect(page.getByText(/Direct Interactions/)).toBeVisible();

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByTestId("share-url").click();

  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("skills=volcanic_fissure,stampede");

  const page2 = await context.newPage();
  await page2.goto(url);
  await expect(page2.getByTestId("tray-entry")).toHaveCount(2);
});
