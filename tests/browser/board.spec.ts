import { expect, test } from "@playwright/test";

test("the departure board hinges real split-flap cards forward and cascades from the left", async ({ page }) => {
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
  // Rows shift up on departure; pick a row whose successor shows a different destination.
  const names = await board.locator("tbody tr td:nth-child(2) .rn-semantic").allTextContents();
  const row = names.findIndex((name, index) => index < names.length - 1 && names[index + 1] !== name);
  expect(row).toBeGreaterThanOrEqual(0);
  const before = names[row + 1]!;
  await page.getByRole("button", { name: "Next departure" }).click();
  const cell = board.locator("tbody tr").nth(row).locator("td").nth(1);
  await expect(cell.locator(".rn-semantic")).toHaveText(before);
  await expect.poll(() => cell.locator(".rn-face").count()).toBeGreaterThan(12);
  const slots = await cell.locator(".rn-slot[data-rn-wheel]").evaluateAll((slots) => slots.map((slot) => {
    const cards = [...slot.querySelectorAll<HTMLElement>(".rn-flap")];
    const hinges = cards.flatMap((card) => card.getAnimations().map((animation) => (animation.effect as KeyframeEffect).getKeyframes().map((frame) => String(frame.transform))));
    return {
      flap: slot.hasAttribute("data-rn-flap"),
      masked: getComputedStyle(slot).maskImage !== "none",
      cards: cards.length,
      // Every card hinges about X: tops fall 0 → -90°, bottoms land 90° → 0.
      hinged: hinges.every((frames) => /rotateX\(0deg\)/.test(frames[0]!) && /rotateX\(-90deg\)/.test(frames.at(-1)!) || /rotateX\(90deg\)/.test(frames[0]!) && /rotateX\(0deg\)/.test(frames.at(-1)!)),
      halves: cards.every((card) => card.classList.contains("rn-flap-top") || card.classList.contains("rn-flap-bottom")),
      // Bounded: two statics plus two cards per step, never more than one revolution.
      bounded: cards.length <= 2 + 2 * 44,
    };
  }));
  expect(slots.length).toBe(12);
  expect(slots.every((slot) => slot.flap && !slot.masked && slot.hinged && slot.halves && slot.bounded)).toBe(true);
  expect(slots.some((slot) => slot.cards > 2)).toBe(true);
  // stagger="start": later characters begin their sequence later.
  const starts = await cell.locator(".rn-slot[data-rn-wheel]").evaluateAll((slots) => slots.map((slot) => Math.min(Infinity, ...slot.querySelectorAll(".rn-flap-top").length ? [...slot.querySelectorAll(".rn-flap-top")].map((card) => Number(card.getAnimations()[0]?.effect?.getComputedTiming().delay ?? Infinity)) : [Infinity])));
  const changed = starts.filter((delay) => Number.isFinite(delay));
  expect(changed.length).toBeGreaterThan(1);
  expect(changed.at(-1)!).toBeGreaterThan(changed[0]!);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  await expect.poll(() => cell.locator(".rn-flap").count()).toBe(0);
  await expect.poll(() => cell.locator(".rn-face").count()).toBe(12);
  expect(await cell.locator(".rn-face").evaluateAll((faces) => faces.map((face) => face.textContent).join(""))).toBe(before);
});
