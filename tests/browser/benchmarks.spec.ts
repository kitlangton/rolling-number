import { expect, test } from "@playwright/test";

test("the comparison page is unlisted and cancels each React renderer cleanly", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href*="benchmarks"]')).toHaveCount(0);
  await page.goto("/benchmarks.html");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("combobox", { name: "Counters", exact: true }).selectOption("10");
  for (const kind of ["rolling", "numberflow", "animated", "countup"]) {
    await page.getByRole("combobox", { name: "Library", exact: true }).selectOption(kind);
    await page.getByRole("button", { name: "Run comparison" }).click();
    await expect(page.locator(".compare-cell")).toHaveCount(10);
    await expect(page.getByRole("status")).toHaveText(/Round 1\/7/, { timeout: 10000 });
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Run canceled");
    await expect(page.locator(".compare-cell")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Run comparison" })).toBeEnabled();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Run comparison" })).toBeDisabled();
  expect(errors).toEqual([]);
});
