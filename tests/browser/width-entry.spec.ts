import { expect, test } from "@playwright/test";
import type {} from "../../demo/test";

test("a fresh grouping comma waits for the digit entrance before fading", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountNumber({ value: 999, locales: "en-US", duration: 600, motionBlur: true }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
    window.testNumber.update({ value: 1000 });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    for (const animation of document.getAnimations()) animation.currentTime = 60;
  });
  const comma = page.locator("[data-rn-key='group:3:,']");
  expect(await comma.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(0);
  await expect(comma.locator(".rn-enter, .rn-smear")).toHaveCount(0);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.currentTime = 130; });
  expect(await comma.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.2);
  await page.evaluate(() => window.testNumber.finish());
  await expect(page.locator(".rn-enter, .rn-smear")).toHaveCount(0);
});

test("replay waits for initialization frames instead of snapping when frames arrive late", async ({ page }) => {
  await page.goto("/motion.html");
  await expect(page.locator(".rn-root").first()).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let id = 1000000;
    window.requestAnimationFrame = (callback) => { callbacks.set(++id, callback); return id; };
    window.cancelAnimationFrame = (id) => { callbacks.delete(id); };
    Reflect.set(window, "flushLabFrames", () => {
      const batch = [...callbacks.values()];
      callbacks.clear();
      for (const callback of batch) callback(performance.now());
    });
  });
  await page.getByRole("button", { name: "Replay expansion" }).click();
  // Deliberately withhold paint beyond the old 100 ms replay timer.
  await page.waitForTimeout(160);
  await expect(page.locator(".rn-value").first()).toHaveText("999");
  await page.evaluate(() => Reflect.get(window, "flushLabFrames")());
  await expect(page.locator(".rn-root").first()).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => Reflect.get(window, "flushLabFrames")());
  await expect(page.locator(".rn-value").first()).toHaveText("1,000");
  await page.evaluate(() => Reflect.get(window, "flushLabFrames")());
  await expect(page.locator(".lab-previews section").first().locator(".rn-enter")).toHaveCount(1);
});
