import { expect, test } from "@playwright/test";

test("lab controls drive separate native width and entry tracks and clean up on reversal", async ({ page }) => {
  await page.goto("/motion.html");
  const current = page.getByRole("region", { name: "Current preview" });
  const experiment = page.getByRole("region", { name: "Experiment preview" });
  await expect(experiment.locator(".rn-root")).toHaveAttribute("data-rn-ready", "");
  await page.getByLabel("Playback").selectOption("4");
  await page.getByRole("button", { name: "Room first", exact: true }).click();
  await expect(experiment.locator(".rn-value")).toHaveText("1,000");
  await expect(experiment.locator(".rn-enter")).toHaveCount(1);
  const durations = async (region: typeof current) => region.evaluate((element) => ({
    width: element.querySelector("[data-rn-key='digit:0']")!.getAnimations()[0]!.effect!.getTiming().duration,
    entry: element.querySelector(".rn-enter")!.getAnimations()[0]!.effect!.getTiming().duration,
  }));
  expect((await durations(current)).width).toBe(2000);
  expect((await durations(experiment)).width).toBe(2600);
  expect((await durations(experiment)).entry).toBe(2090);
  await page.getByRole("button", { name: "Reverse now" }).click();
  await expect(experiment.locator(".rn-value")).toHaveText("999");
  await expect(experiment.locator(".rn-slot")).toHaveCount(3);
  await expect(experiment.locator(".rn-enter, .rn-smear")).toHaveCount(0);
  await expect.poll(() => experiment.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test("twelve presets replay automatically and rapid selection keeps only the latest choice", async ({ page }) => {
  await page.goto("/motion.html");
  const preview = page.getByRole("region", { name: "Experiment preview" });
  await expect(page.locator(".lab-presets button")).toHaveCount(12);
  await page.getByRole("button", { name: "Drop in", exact: true }).click();
  await expect(page.getByLabel("Rise distance")).toHaveValue("-70");
  await expect(preview.locator(".rn-value")).toHaveText("1,000");
  await page.getByRole("button", { name: "Next preset", exact: true }).click();
  await expect(page.getByRole("button", { name: "Soft drop", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Same-task selection exercises replacement of the pending initialization frames.
  await page.evaluate(() => {
    for (const name of ["Late arrival", "Hard cut width", "Almost still"]) {
      document.querySelector<HTMLButtonElement>(`.lab-presets [aria-label="${name}"]`)!.click();
    }
  });
  await expect(preview.locator("h3 span")).toHaveText("Almost still");
  await expect(preview.locator(".rn-value")).toHaveText("1,000");
  await expect(page.getByLabel("Width duration")).toHaveValue("400");
  await expect.poll(() => preview.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(preview.locator(".rn-slot")).toHaveCount(5);
  await expect(preview.locator(".rn-enter, .rn-smear")).toHaveCount(0);
});

test("lab replays from the keyboard, respects reduced motion, and fits mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto("/motion.html");
  const preview = page.getByRole("region", { name: "Experiment preview" });
  await page.getByRole("button", { name: "Quiet fade", exact: true }).click();
  await page.getByRole("button", { name: "Replay expansion" }).focus();
  await page.keyboard.press("Enter");
  await expect(preview.locator(".rn-value")).toHaveText("1,000");
  await expect(preview.locator(".rn-enter")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Loop", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Reverse now" }).click();
  await expect(preview.locator(".rn-value")).toHaveText("999");
  await expect.poll(() => preview.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
