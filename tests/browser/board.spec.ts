import { expect, test } from "@playwright/test";
import { titleWidth } from "../../demo/pull-requests";

declare global {
  interface Window { tickReviewState: () => void }
}

test("the pull-request board hinges real split-flap cards forward and cascades from the left", async ({ page }) => {
  await page.goto("/board.html?renderer=dom");
  const board = page.locator(".board");
  await expect(board.locator("tbody tr")).toHaveCount(6);
  await expect(board.locator(".board-title .rn-semantic")).toHaveText("PULL REQUESTS");
  await expect(board.locator("tbody .rn-root[data-rn-ready]").first()).toBeVisible();
  // Static, readable text is present for assistive technology and SSR.
  await expect(board.locator("tbody tr").first().locator("td").nth(3).locator(".rn-semantic")).toHaveText(/IN REVIEW|APPROVED|CHANGES|CI FAILED|DRAFT|MERGING/);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
  });
  // Pick a row whose successor has a different title.
  const names = await board.locator("tbody tr td:nth-child(2) .rn-semantic").allTextContents();
  const row = names.findIndex((name, index) => index < names.length - 1 && names[index + 1] !== name);
  expect(row).toBeGreaterThanOrEqual(0);
  const before = names[row + 1]!;
  await page.getByRole("button", { name: "Next PR" }).click();
  const cell = board.locator("tbody tr").nth(row).locator("td").nth(1);
  await expect(cell.locator(".rn-semantic")).toHaveText(before);
  await expect.poll(() => cell.locator(".rn-face").count()).toBeGreaterThan(titleWidth);
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
      bounded: cards.length === 0 || cards.length === 4,
    };
  }));
  expect(slots.length).toBe(titleWidth);
  expect(slots.every((slot) => slot.flap && !slot.masked && slot.hinged && slot.halves && slot.bounded)).toBe(true);
  expect(slots.some((slot) => slot.cards > 2)).toBe(true);
  // stagger="start": later characters begin their sequence later.
  const starts = await cell.locator(".rn-slot[data-rn-wheel]").evaluateAll((slots) => slots.map((slot) => Math.min(Infinity, ...[...slot.querySelectorAll(".rn-flap-top")].flatMap((card) => card.getAnimations().map((animation) => {
    const effect = animation.effect as KeyframeEffect;
    const frames = effect.getKeyframes();
    const moving = frames.findIndex((frame) => frame.transform !== frames[0]!.transform);
    const timing = effect.getComputedTiming();
    // A top card is revealed under its predecessor before it starts falling.
    // Count the stationary hold as part of the stagger, not as an early flip.
    return moving < 1 ? Infinity : Number(timing.delay) + frames[moving - 1]!.computedOffset * Number(timing.duration);
  })))));
  const changed = starts.filter((delay) => Number.isFinite(delay));
  expect(changed.length).toBeGreaterThan(1);
  expect(changed.at(-1)!).toBeGreaterThan(changed[0]!);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  await expect.poll(() => cell.locator(".rn-flap").count()).toBe(0);
  await expect.poll(() => cell.locator(".rn-face").count()).toBe(titleWidth);
  expect(await cell.locator(".rn-face").evaluateAll((faces) => faces.map((face) => face.textContent).join(""))).toBe(before);
});

test("comment counts keep two permanent digit drums when gaining and losing a tens digit", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => .314159; });
  await page.goto("/board.html?renderer=dom");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const comments = page.locator("tbody td:nth-child(3) .rn-root");
  await expect(comments).toHaveCount(6);
  await expect(comments.first()).toHaveAttribute("data-rn-ready", "");
  const before = await comments.evaluateAll((roots) => roots.map((root, row) => ({
    text: root.querySelector(".rn-value")!.textContent,
    width: root.getBoundingClientRect().width,
    slots: [...root.querySelectorAll<HTMLElement>(".rn-slot")].map((slot, index) => slot.dataset.testDrum = `${row}:${index}`),
  })));
  expect(before.map((row) => row.slots.length)).toEqual([2, 2, 2, 2, 2, 2]);
  expect(before.map((row) => row.text)).toEqual(["20", "22", "24", " 0", "14", "13"]);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { const animation = animate.apply(this, args); animation.pause(); animation.currentTime = 0; return animation; };
  });
  await page.getByRole("button", { name: "Next PR" }).click();
  await expect(comments.nth(3).locator(".rn-value")).toHaveText("14");
  await expect.poll(() => comments.locator(".rn-flap").count()).toBeGreaterThan(0);
  const after = await comments.evaluateAll((roots) => roots.map((root) => ({
    text: root.querySelector(".rn-value")!.textContent,
    width: root.getBoundingClientRect().width,
    slots: [...root.querySelectorAll<HTMLElement>(".rn-slot")].map((slot) => slot.dataset.testDrum),
    movingSlots: [...root.querySelectorAll(".rn-slot")].some((slot) => slot.getAnimations().length > 0),
  })));
  expect(after[2]!.text).toBe(" 0"); // 24 → 0, in the same shift as 0 → 14.
  expect(after.map((row) => row.slots)).toEqual(before.map((row) => row.slots));
  for (let row = 0; row < before.length; row++) expect(after[row]!.width).toBeCloseTo(before[row]!.width, 2);
  expect(after.some((row) => row.movingSlots)).toBe(false);
  await expect(comments.locator(".rn-enter")).toHaveCount(0);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  await expect(comments.locator(".rn-flap")).toHaveCount(0);
  expect(await comments.evaluateAll((roots) => roots.every((root) => root.querySelectorAll(".rn-slot").length === 2))).toBe(true);
});

test("the fixed-width PR fields fit mobile and tablet layouts", async ({ page }) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/board.html?renderer=dom");
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
    const layout = await page.evaluate(() => {
      const board = document.querySelector(".board")!.getBoundingClientRect();
      const table = document.querySelector(".board-table")!.getBoundingClientRect();
      return { page: document.documentElement.scrollWidth, boardRight: board.right, tableRight: table.right };
    });
    expect(layout.page).toBeLessThanOrEqual(width);
    expect(layout.tableRight).toBeLessThanOrEqual(layout.boardRight - 10);
  }
});

test("bulk shifts stay crisp while individual review updates use vertical blur", async ({ page }) => {
  await page.addInitScript(() => {
    const schedule = window.setInterval.bind(window);
    window.setInterval = ((...[handler, timeout, ...args]: Parameters<typeof window.setInterval>) => {
      if (typeof handler === "function" && timeout === 2600) {
        window.tickReviewState = () => handler(...args);
        return schedule(() => {}, timeout);
      }
      return schedule(handler, timeout, ...args);
    }) as typeof window.setInterval;
  });
  await page.goto("/board.html?renderer=dom");
  await expect(page.getByRole("checkbox", { name: "Full-board blur" })).not.toBeChecked();
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { const animation = animate.apply(this, args); animation.pause(); animation.currentTime = 0; return animation; };
  });
  const table = page.locator(".board-table");
  await page.getByRole("button", { name: "Next PR" }).click();
  await expect.poll(() => table.locator(".rn-flap").count()).toBeGreaterThan(0);
  await expect(table.locator(".rn-flap-smear")).toHaveCount(0);
  await table.evaluate((node) => { for (const animation of node.getAnimations({ subtree: true })) animation.finish(); });
  await expect(table.locator(".rn-flap")).toHaveCount(0);
  await page.evaluate(() => window.tickReviewState());
  await expect.poll(() => table.locator(".rn-flap-smear").count()).toBeGreaterThan(0);
  expect(await table.locator("td:nth-child(4)").evaluateAll((cells) => cells.filter((cell) => cell.querySelector(".rn-flap-smear")).length)).toBe(1);
  await expect(table.locator("td:nth-child(2) .rn-flap-smear")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Full-board blur" }).check();
  await page.getByRole("button", { name: "Next PR" }).click();
  await expect.poll(() => table.locator("td:nth-child(2) .rn-flap-smear").count()).toBeGreaterThan(0);
});
