import { expect, test } from "@playwright/test";
import { blurEnvelope, delayed, spring } from "../../src/motion";
import type {} from "../../demo/test";

for (const compact of [true, false]) {
  test(`opacity playback matches explicit native samples, including blur pulses (linear support=${compact})`, async ({ page }) => {
    if (!compact) await page.addInitScript(() => { CSS.supports = () => false; });
    await page.goto("/test.html");
    await page.waitForFunction(() => window.ready);
    const motions = [
      spring(0, 1, 0, 500),
      spring(1, 0, 0, 500),
      spring(1.03, 1, -4.5, 1000),
      spring(-.03, 0, 4.5, 1000),
      delayed(spring(0, 1, 0, 500), 70),
      blurEnvelope(spring(0, 8, 0, 500)),
      blurEnvelope(spring(3, 1, -8, 500), .4),
    ];
    for (const motion of motions) for (const invert of [false, true]) {
      const result = await page.evaluate(({ motion, invert }) => window.opacityPlaybackProbe(motion, invert), { motion, invert });
      expect(result.maxError).toBeLessThan(.00001);
      expect(result.keyframes).toBe(compact ? 2 : motion.points.length);
      expect(result.remaining).toBe(0);
    }
  });
}
