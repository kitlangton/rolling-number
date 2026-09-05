import { expect, test } from "@playwright/test";
import type {} from "../../demo/test";

test("direct text keeps the visible letters on interruption without cycling an alphabet", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountText({ text: "a", transition: "direct", motionBlur: true, duration: 500 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const result = await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { const a = animate.apply(this, args); a.pause(); a.currentTime = 0; return a; };
    const flush = async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); };
    window.testText.update({ text: "b" }); await flush();
    for (const a of document.getAnimations()) a.currentTime = 100;
    const before = document.querySelector(".rn-sharp .rn-face")!.getBoundingClientRect().top;
    window.testText.update({ text: "c" }); await flush();
    const after = document.querySelector(".rn-sharp .rn-face")!.getBoundingClientRect().top;
    const letters = [...document.querySelectorAll(".rn-sharp .rn-face")].map((face) => face.textContent);
    return { before, after, letters };
  });
  expect(result.after).toBeCloseTo(result.before, 1);
  expect(result.letters).toEqual(["a", "b", "c"]);
  await page.evaluate(() => { for (const a of document.getAnimations()) a.finish(); });
  await expect(page.locator(".rn-face")).toHaveCount(1);
  await expect(page.locator(".rn-face")).toHaveText("c");
  await page.evaluate(() => window.testText.update({ text: "Hello 🙂", animated: false }));
  await expect(page.locator("#number > .rn-value")).toHaveText("Hello 🙂");
  await expect(page.locator(".rn-smear")).toHaveCount(0);
});

test("the words example reveals new labels and the seat label uses RollingNumber", async ({ page }) => {
  await page.goto("/");
  const words = page.locator(".words-app");
  await words.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Roll the words" }).click();
  await expect(words.locator(".rn-semantic")).toHaveText("Ready to roll");
  await expect.poll(() => words.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await expect.poll(() => words.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator(".seat-control output .rn-semantic")).toHaveText("8");
  await page.locator("#seats").press("ArrowRight");
  await expect(page.locator(".seat-control output .rn-semantic")).toHaveText("9");
  expect(await page.locator(".seat-control output").evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
});

test("repeated direct retargets stay bounded and changing transition modes settles safely", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountText({ text: "Hello", transition: "direct", duration: 500, motionBlur: true }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      window.testText.update({ text: i % 2 ? "Hello" : "Ready" });
      await new Promise(requestAnimationFrame);
    }
  });
  expect(await page.locator(".rn-face").count()).toBeLessThanOrEqual(30); // Five slots, three glyphs, sharp/smear pair.
  await page.evaluate(() => window.testText.update({ text: "WORLD", transition: "wheel" }));
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator(".rn-face")).toHaveText(["W", "O", "R", "L", "D"]);
  const atomic = await page.evaluate(() => {
    try { window.testText.update({ text: "invalid", transition: "direct", mode: "flap" }); return false; }
    catch (error) { return error instanceof RangeError; }
  });
  expect(atomic).toBe(true);
  await expect(page.locator("#number > .rn-value")).toHaveText("WORLD");
  await page.evaluate(() => window.testText.update({ text: "Ready", transition: "direct" }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#number")).not.toHaveAttribute("data-rn-ready", "");
  await expect(page.locator("#number > .rn-value")).toHaveText("Ready");
});
