import { expect, test } from "@playwright/test";
import type {} from "../../demo/test";

test("same-width updates preserve horizontal playback and its original deadline", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => {
    window.mountNumber({ value: 99, duration: 500, format: { useGrouping: false } });
    document.getElementById("number")!.style.fontFamily = "monospace";
  });
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const result = await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
    const flush = async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    };
    const slot = document.querySelector<HTMLElement>("[data-rn-key='digit:0']")!;
    const horizontal = () => slot.getAnimations().find((animation) =>
      (animation.effect as KeyframeEffect).getKeyframes().some((frame) => "transform" in frame));
    try {
      window.testNumber.update({ value: 100 });
      await flush();
      const original = horizontal();
      if (!original) throw new Error("Expected a width-change animation");
      let retained = true;
      let maxJump = 0;
      for (const time of [100, 200, 300, 400]) {
        for (const animation of document.getAnimations()) animation.currentTime = Number(animation.currentTime) + 100;
        const before = slot.getBoundingClientRect().x;
        window.testNumber.update({ value: 100 + time / 100 });
        await flush();
        retained &&= horizontal() === original && original.currentTime === time;
        maxJump = Math.max(maxJump, Math.abs(slot.getBoundingClientRect().x - before));
      }
      // At the original deadline the glyph must be at its measured destination,
      // not on another 500 ms spring started by the last digit update.
      const current = horizontal()!;
      current.currentTime = Number(current.currentTime) + 100;
      const target = document.querySelector<HTMLElement>(".rn-measure")!.lastElementChild!.getBoundingClientRect().x;
      const deadlineError = Math.abs(slot.getBoundingClientRect().x - target);
      window.testNumber.refresh();
      await flush();
      return { retained, maxJump, deadlineError, animationsAfterRefresh: document.getAnimations().length };
    } finally {
      Element.prototype.animate = animate;
      window.testNumber.finish();
    }
  });
  expect(result.retained).toBe(true);
  expect(result.maxJump).toBeLessThan(.5);
  expect(result.deadlineError).toBeLessThan(.5);
  expect(result.animationsAfterRefresh).toBe(0);
});
