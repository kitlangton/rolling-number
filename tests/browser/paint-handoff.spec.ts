import { expect, test } from "@playwright/test";
import { horizontalInkCenter, preparePaintHandoff, sampleBlurPaint, samplePaintHandoff, verticalInkEdges } from "./paint-handoff";

test.use({ deviceScaleFactor: 2, viewport: { width: 800, height: 800 } });

for (const entry of [false, true]) for (const size of [16, 32, 36, 48, 144]) for (const blur of [false, true]) {
  test(`paint stays horizontally aligned through native completion (${entry ? "entry" : "roll"}, ${size}px, blur=${blur})`, async ({ page }) => {
    await page.goto("/test.html");
    await page.waitForFunction(() => window.ready);
    await page.evaluate(preparePaintHandoff, { size, blur, entry });
    const centers: number[] = [];
    for (const phase of ["live", "end", "cleanup"] as const) {
      const state = await page.evaluate(samplePaintHandoff, phase);
      if (phase === "cleanup") {
        expect(state.faces).toBe(1);
        expect(state.effects).toBe(0);
      }
      const image = await page.screenshot();
      centers.push(await page.evaluate(horizontalInkCenter, image.toString("base64")));
    }
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(.1);
  });
}

for (const size of [16, 32, 144]) {
  test(`the stable paint surface still paints vertical motion blur (${size}px)`, async ({ page }) => {
    await page.goto("/test.html");
    await page.waitForFunction(() => window.ready);
    await page.evaluate(preparePaintHandoff, { size, blur: true });
    const edges: number[] = [];
    for (const blurred of [true, false]) {
      await page.evaluate(sampleBlurPaint, blurred);
      edges.push(await page.evaluate(verticalInkEdges, (await page.screenshot()).toString("base64")));
    }
    expect(edges[0]! / edges[1]!).toBeLessThan(.95);
  });
}
