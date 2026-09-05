import { expect, test } from "@playwright/test";

declare global {
  interface Window { boardClockTest: { time: number; tick: () => void } }
}

test.use({ timezoneId: "UTC" });

test("clock ticks have a visible fold and 59 to 00 advances each seconds drum once", async ({ page }) => {
  await page.addInitScript(() => {
    window.boardClockTest = { time: Date.parse("2026-09-04T12:34:58Z"), tick: () => {} };
    const NativeDate = Date;
    globalThis.Date = new Proxy(NativeDate, {
      construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [window.boardClockTest.time], newTarget),
    });
    const schedule = window.setInterval.bind(window);
    window.setInterval = ((...[handler, timeout, ...args]: Parameters<typeof window.setInterval>) => {
      if (typeof handler === "function" && timeout === 1000) {
        window.boardClockTest.tick = () => handler(...args);
        return schedule(() => {}, timeout);
      }
      return schedule(handler, timeout, ...args);
    }) as typeof window.setInterval;
  });
  await page.goto("/board.html?renderer=dom");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const clock = page.locator(".board-clock");
  await expect(clock.locator(".rn-semantic")).toHaveText(["12", "34", "58"]);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { const animation = animate.apply(this, args); animation.pause(); animation.currentTime = 0; return animation; };
    window.boardClockTest.time += 1000;
    window.boardClockTest.tick();
  });
  await expect(clock.locator(".rn-semantic")).toHaveText(["12", "34", "59"]);
  await expect(clock.locator(".rn-flap")).toHaveCount(4);
  const durations = await clock.locator(".rn-flap").evaluateAll((cards) => cards.flatMap((card) => card.getAnimations().map((animation) => Number(animation.effect!.getTiming().duration))));
  expect(durations).toEqual([220, 220]);
  const angle = await clock.evaluate((root) => {
    for (const animation of root.getAnimations({ subtree: true })) animation.currentTime = 88;
    const falling = [...root.querySelectorAll(".rn-flap-top")].find((card) => card.getAnimations().length)!;
    return Math.acos(Math.max(-1, Math.min(1, new DOMMatrix(getComputedStyle(falling).transform).m22))) * 180 / Math.PI;
  });
  expect(angle).toBeGreaterThan(20);
  expect(angle).toBeLessThan(89);
  const blur = await clock.locator("feGaussianBlur").getAttribute("stdDeviation");
  expect(blur!.split(" ").map(Number)[0]).toBe(0);
  expect(blur!.split(" ").map(Number)[1]).toBeGreaterThan(1);
  await expect(clock.locator(".rn-flap-smear")).toHaveCount(2);
  await clock.evaluate((root) => { for (const animation of root.getAnimations({ subtree: true })) animation.finish(); });
  await expect(clock.locator(".rn-flap")).toHaveCount(0);
  await page.evaluate(() => { window.boardClockTest.time += 1000; window.boardClockTest.tick(); });
  await expect(clock.locator(".rn-semantic")).toHaveText(["12", "35", "00"]);
  await expect(clock.locator(".rn-flap")).toHaveCount(12);
  const wrapDurations = await clock.locator(".rn-flap").evaluateAll((cards) => cards.flatMap((card) => card.getAnimations().map((animation) => Number(animation.effect!.getTiming().duration))));
  expect(wrapDurations).toEqual(Array(6).fill(220));
});
