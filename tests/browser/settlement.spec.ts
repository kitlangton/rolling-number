import { expect, test } from "@playwright/test";

test.use({ deviceScaleFactor: 2 });

for (const value of [1000, 2000, 3000]) test(`the main ticker's ${value / 1000} stays painted in place at the roll-to-rest handoff`, async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.addInitScript(() => {
    const interval = window.setInterval.bind(window);
    const ids: number[] = [];
    Reflect.set(window, "setInterval", (handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      const id = interval(handler, delay, ...args);
      if (delay === 33) ids.push(id);
      return id;
    });
    Reflect.set(window, "stopTicker", () => ids.forEach((id) => clearInterval(id)));
  });
  await page.goto("/");
  await page.waitForFunction((value) => Number(document.querySelector(".number-frame .rn-semantic")?.textContent?.replace(/[^0-9]/g, "")) >= value, value);
  await page.evaluate(async () => {
    Reflect.get(window, "stopTicker")();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const callbacks: (() => void)[] = [];
    // Paint exact animation endpoints, but defer cleanup so it cannot conceal a
    // glyph moving by a device pixel when its strip becomes a single face.
    for (const animation of document.getAnimations()) {
      const finish = animation.onfinish;
      callbacks.push(() => finish?.call(animation, new Event("finish") as AnimationPlaybackEvent));
      animation.onfinish = null;
      animation.pause();
      animation.currentTime = Number(animation.effect!.getTiming().duration);
    }
    Reflect.set(window, "finishTickerTracks", () => callbacks.forEach((callback) => callback()));
  });
  const slot = page.locator(".number-frame [data-rn-key='digit:3']");
  const bounds = await slot.evaluate((element) => {
    const slot = element.getBoundingClientRect();
    const reel = element.querySelector(".rn-reel")!.getBoundingClientRect();
    return { x: Math.floor(reel.x), y: Math.floor(slot.y), width: Math.ceil(reel.width), height: Math.ceil(slot.height) };
  });
  const landed = await page.screenshot({ clip: bounds });
  await page.evaluate(() => Reflect.get(window, "finishTickerTracks")());
  await expect(slot.locator(".rn-face")).toHaveCount(1);
  await expect(slot.locator(".rn-face")).toHaveText(String(value / 1000));
  await expect(slot.locator(".rn-enter, .rn-smear")).toHaveCount(0);
  const settled = await page.screenshot({ clip: bounds });
  const difference = await page.evaluate(async ({ before, after }) => {
    const images = await Promise.all([before, after].map(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height);
    }));
    let error = 0;
    const centers = images.map(({ data, width, height }) => {
      let mass = 0, xMoment = 0, yMoment = 0;
      const background = data[0]!;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const ink = Math.abs(data[(y * width + x) * 4]! - background);
        mass += ink; xMoment += ink * x; yMoment += ink * y;
      }
      if (!mass) throw new Error("No glyph painted in settlement capture");
      return { x: xMoment / mass, y: yMoment / mass };
    });
    for (let i = 0; i < images[0]!.data.length; i += 4) {
      error += Math.abs(images[0]!.data[i]! - images[1]!.data[i]!);
    }
    return {
      meanError: error / (images[0]!.width * images[0]!.height),
      dx: Math.abs(centers[1]!.x - centers[0]!.x) / devicePixelRatio,
      dy: Math.abs(centers[1]!.y - centers[0]!.y) / devicePixelRatio,
    };
  }, { before: landed.toString("base64"), after: settled.toString("base64") });
  // Layer compaction can change a few antialiased edge samples in Chromium.
  // Bound that noise as well as spatial drift, rather than requiring identical
  // PNG bytes. A shifted glyph changes far more than .05 of one color level.
  expect(difference.meanError).toBeLessThan(.05);
  expect(difference.dx).toBeLessThan(.01);
  expect(difference.dy).toBeLessThan(.01);
});
