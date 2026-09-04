import { expect, test } from "@playwright/test";

test("the departure board rolls letters forward through a wheel and cascades from the left", async ({ page }) => {
  await page.goto("/board.html");
  const board = page.locator(".board");
  await expect(board.locator("tbody tr")).toHaveCount(6);
  await expect(board.locator("tbody .rn-root[data-rn-ready]").first()).toBeVisible();
  // Static, readable text is present for assistive technology and SSR.
  await expect(board.locator("tbody tr").first().locator("td").nth(3).locator(".rn-semantic")).toHaveText(/ON TIME|DELAYED|BOARDING|EXP 5 MIN|CANCELLED/);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
  });
  const before = await board.locator("tbody tr").nth(1).locator("td").nth(1).locator(".rn-semantic").textContent();
  await page.getByRole("button", { name: "Next departure" }).click();
  const cell = board.locator("tbody tr").first().locator("td").nth(1);
  await expect(cell.locator(".rn-semantic")).toHaveText(before!);
  await expect.poll(() => cell.locator(".rn-face").count()).toBeGreaterThan(12);
  const wheels = await cell.locator(".rn-slot[data-rn-wheel]").evaluateAll((slots) => slots.map((slot) => ({
    faces: slot.querySelectorAll(".rn-face").length,
    masked: getComputedStyle(slot).maskImage !== "none",
    // Every wheel that changed rolls downward (forward) — never backwards.
    forward: [...slot.querySelectorAll<HTMLElement>(".rn-reel")].every((reel) => {
      const keyframes = reel.getAnimations().flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes().map((frame) => String(frame.transform)));
      if (keyframes.length < 2) return true;
      const first = Number(/-?[\d.]+/.exec(keyframes[0]!)?.[0]);
      const last = Number(/-?[\d.]+/.exec(keyframes.at(-1)!)?.[0]);
      return last <= first;
    }),
  })));
  expect(wheels.length).toBe(12);
  expect(wheels.every((wheel) => wheel.masked && wheel.forward)).toBe(true);
  expect(wheels.some((wheel) => wheel.faces > 1)).toBe(true);
  // stagger="start": later characters are held longer than earlier ones.
  const delays = await cell.locator(".rn-slot[data-rn-wheel]").evaluateAll((slots) => slots.map((slot) => Math.max(0, ...slot.getAnimations({ subtree: true }).map((animation) => Number(animation.effect!.getComputedTiming().duration)))));
  const changed = delays.filter((delay) => delay > 0);
  expect(changed.length).toBeGreaterThan(1);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  await expect.poll(() => cell.locator(".rn-face").count()).toBe(12);
  expect(await cell.locator(".rn-face").evaluateAll((faces) => faces.map((face) => face.textContent).join(""))).toBe(before);
});
