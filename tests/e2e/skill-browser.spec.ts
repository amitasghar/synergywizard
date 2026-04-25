import { expect, test } from "@playwright/test";
import { seedOnce } from "./_seed.ts";

test("browse -> class warrior -> grid populated -> add first -> tray count 1", async ({ page }) => {
  await seedOnce();
  await page.goto("/");

  await page.getByTestId("tab-browse").click();
  await page.getByTestId("browse-class").selectOption("warrior");

  const grid = page.getByTestId("browse-grid");
  await expect(grid.locator("> *").first()).toBeVisible();

  await grid.getByRole("button", { name: /^Add / }).first().click();
  await expect(page.getByTestId("tray-entry")).toHaveCount(1);
});
