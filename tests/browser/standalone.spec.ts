import { expect, test } from "@playwright/test";

test("the flap experiment is not advertised on the number showcase", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "rolling number", exact: true })).toBeVisible();
  await expect(page.locator('a[href*="board.html"], .board-teaser')).toHaveCount(0);
});
