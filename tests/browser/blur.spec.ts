import { expect, test } from "@playwright/test";
import type {} from "../../demo/test";

test("blurred playback does not read layout and releases temporary copies on settlement", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountNumber({ value: 1234, motionBlur: true, duration: 600, pauseOffscreen: false }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => window.testNumber.update({ value: 1899 }));
  await expect.poll(() => page.locator(".rn-smear").count()).toBeGreaterThan(0);
  const reads = await page.evaluate(async () => {
    const original = Element.prototype.getBoundingClientRect;
    let reads = 0;
    Element.prototype.getBoundingClientRect = function () { reads++; return original.call(this); };
    try {
      for (let frame = 0; frame < 8; frame++) await new Promise(requestAnimationFrame);
      return reads;
    } finally { Element.prototype.getBoundingClientRect = original; }
  });
  expect(reads).toBe(0);
  await page.evaluate(async () => {
    for (let index = 0; index < 30; index++) {
      window.testNumber.update({ value: index % 2 ? 1299 : 9843 });
      await new Promise(requestAnimationFrame);
    }
  });
  expect(await page.locator("#number *").count()).toBeLessThan(250);
  await expect(page.locator(".rn-blur-defs")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator(".rn-smear, .rn-sharp")).toHaveCount(0);
  expect(await page.locator(".rn-face").count()).toBe(await page.locator(".rn-token").count());
  await page.evaluate(() => window.testNumber.destroy());
  await expect(page.locator(".rn-blur-defs")).toHaveCount(0);
});

test("optional blur is vertical, speed-driven, interruptible and cleaned up", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountNumber({ value: 1200, motionBlur: true, locales: "en-US", duration: 600, format: { style: "unit", unit: "millisecond" } }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await expect(page.locator(".rn-smear")).toHaveCount(0);
  await page.evaluate(() => window.testNumber.update({ value: 1289 }));
  await expect(page.locator(".rn-smear")).toHaveCount(2);
  await expect(page.locator("[data-rn-key='digit:3'] .rn-smear, [data-rn-key^='unit:'] .rn-smear")).toHaveCount(0);
  const deviation = (await page.locator(".rn-blur-defs feGaussianBlur").getAttribute("stdDeviation"))!.split(" ").map(Number);
  expect(deviation[0]).toBe(0);
  expect(deviation[1]).toBeGreaterThan(0);
  await page.evaluate(() => { for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 100; } });
  const smear = page.locator("[data-rn-key='digit:0'] .rn-smear");
  const before = await smear.evaluate((element) => Number(getComputedStyle(element).opacity));
  expect(before).toBeGreaterThan(.5);
  const sharp = await page.locator("[data-rn-key='digit:0'] .rn-sharp").evaluate((element) => Number(getComputedStyle(element).opacity));
  expect(sharp + before).toBeCloseTo(1, 5);
  await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
    window.testNumber.update({ value: 1245 });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  expect(await smear.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeCloseTo(before, 5);
  await expect(page.locator(".rn-smear .rn-smear")).toHaveCount(0);
  await expect(page.locator(".rn-blur-defs")).toHaveCount(1);
  await page.evaluate(() => window.testNumber.update({ motionBlur: false }));
  await expect(page.locator(".rn-smear, .rn-sharp, .rn-blur-defs")).toHaveCount(0);
  expect(await page.locator(".rn-reel").first().evaluate((element) => element.parentElement!.closest(".rn-root")!.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await page.evaluate(() => window.testNumber.update({ motionBlur: true, value: 1289 }));
  await expect(page.locator(".rn-smear")).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".rn-smear, .rn-blur-defs")).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator("#number > .rn-value")).toHaveText("1,289 ms");
  await page.evaluate(() => window.testNumber.destroy());
  await expect(page.locator("#number")).toHaveText("1,289 ms");
});
