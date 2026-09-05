import { expect, test } from "@playwright/test";
import type {} from "../../demo/test";

for (const scheme of ["light", "dark"]) {
  test(`default ${scheme} flap surfaces hide the waiting glyph`, async ({ page }) => {
    await page.goto("/test.html");
    await page.waitForFunction(() => window.ready);
    await page.evaluate((scheme) => {
      document.documentElement.style.colorScheme = scheme;
      document.body.style.background = "Canvas";
      document.body.style.color = "CanvasText";
      window.mountText({ text: "A", charset: "AB", mode: "flap", duration: 700 });
      document.getElementById("number")!.style.font = "64px/1 monospace";
    }, scheme);
    await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
    await page.evaluate(async () => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) { const animation = animate.apply(this, args); animation.pause(); animation.currentTime = 0; return animation; };
      window.testText.update({ text: "B" });
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    });
    const box = (await page.locator(".rn-slot").boundingBox())!;
    // Exclude the antialiased hinge edge, where two half-card clips can overlap.
    const x = Math.max(0, Math.ceil(box.x));
    const clip = { x, y: Math.ceil(box.y), width: Math.floor(box.x + box.width) - x, height: Math.floor(box.height / 2 - 2) };
    const covered = await page.screenshot({ clip });
    await page.locator(".rn-flap-top").first().evaluate((card) => (card as HTMLElement).style.visibility = "hidden");
    const hidden = await page.screenshot({ clip });
    expect(covered.equals(hidden)).toBe(true);
    // Negative control: transparent paper reveals B through the holes in A.
    await page.locator(".rn-flap-top").first().evaluate((card) => (card as HTMLElement).style.visibility = "");
    await page.locator(".rn-flap-top").last().evaluate((card) => (card as HTMLElement).style.background = "transparent");
    const leaking = await page.screenshot({ clip });
    expect(leaking.equals(covered)).toBe(false);
  });
}

test("a line-break glyph occupies one strip row, not two", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountText({ text: "A", charset: "A\nB", mode: "flap", duration: 700 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const rows = await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { const animation = animate.apply(this, args); animation.pause(); animation.currentTime = 0; return animation; };
    window.testText.update({ text: "B" });
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    const plane = document.querySelector<HTMLElement>(".rn-flap-bottom")!;
    const rows = [...plane.firstElementChild!.children];
    const top = rows[0]!.getBoundingClientRect().top;
    return { text: rows.map((row) => row.textContent), offsets: rows.map((row) => (row.getBoundingClientRect().top - top) / parseFloat(plane.style.height)) };
  });
  expect(rows.text).toEqual(["A", "\n", "B"]);
  rows.offsets.forEach((offset, index) => expect(offset).toBeCloseTo(index, 3));
  await page.evaluate(() => window.testText.finish());
  await expect(page.locator("#number > .rn-value")).toHaveText("B");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("native flap playback does not read layout and destroy releases its effects", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountText({ text: "A", charset: "ABCDEFGHIJKLM", mode: "flap", duration: 700, motionBlur: true }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(async () => {
    window.testText.update({ text: "M" });
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
  });
  const result = await page.evaluate(async () => {
    let reads = 0;
    const read = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () { reads++; return read.call(this); };
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const moving = document.getAnimations().length;
      window.testText.destroy();
      return { reads, moving, remaining: document.getAnimations().length };
    } finally { Element.prototype.getBoundingClientRect = read; }
  });
  expect(result.reads).toBe(0);
  expect(result.moving).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
});
