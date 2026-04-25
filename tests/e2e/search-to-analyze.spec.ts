import { expect, test } from "@playwright/test";
import { seedOnce } from "./_seed.ts";

test("search volcanic -> add + Stampede -> analyze shows Direct Interactions", async ({ page }) => {
  await seedOnce();
  await page.goto("/");

  await page.getByTestId("tab-search").click();
  await page.getByPlaceholder(/search/i).fill("volcanic");
  await expect(page.getByText("Volcanic Fissure")).toBeVisible();
  await page.getByRole("button", { name: /Add Volcanic Fissure/i }).click();

  await page.getByPlaceholder(/search/i).fill("stampede");
  await expect(page.getByText("Stampede")).toBeVisible();
  await page.getByRole("button", { name: /Add Stampede/i }).click();

  await expect(page.getByTestId("tray-entry")).toHaveCount(2);
  await page.getByTestId("analyze-button").click();

  await expect(page.getByText(/Direct Interactions/)).toBeVisible();
  await expect(page.getByTestId("direct-interactions").locator("li")).not.toHaveCount(0);
});
