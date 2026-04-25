import { expect, test } from "@playwright/test";
import { seedOnce } from "./_seed.ts";

test("export markdown triggers download with .md extension", async ({ page }) => {
  await seedOnce();

  await page.goto("/");
  await page.getByTestId("tab-search").click();
  await page.getByPlaceholder(/search/i).fill("volcanic");
  await page.getByRole("button", { name: /Add Volcanic Fissure/i }).click();
  await page.getByPlaceholder(/search/i).fill("stampede");
  await page.getByRole("button", { name: /Add Stampede/i }).click();
  await page.getByTestId("analyze-button").click();
  await expect(page.getByText(/Direct Interactions/)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-dropdown").locator("summary").click(),
    page.getByTestId("export-md").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.md$/);
});
