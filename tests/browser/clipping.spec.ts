import { expect, test } from "@playwright/test";

test("shrinking prices remain painted beyond the new container width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/");
  const price = page.locator(".price");
  await price.scrollIntoViewIfNeeded();
  await expect(price.locator(".rn-root")).toHaveAttribute("data-rn-ready", "");
  const slider = page.locator("#seats");
  const box = (await slider.boundingBox())!;
  await slider.click({ position: { x: box.width - 1, y: box.height / 2 } });
  await expect(price.locator(".rn-semantic")).toHaveText("$288");
  await expect.poll(() => price.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
  });
  await slider.click({ position: { x: 1, y: box.height / 2 } });
  await expect(price.locator(".rn-semantic")).toHaveText("$12");
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  // This probe is inside the still-visible last digit, not outside its reel mask.
  await price.locator("[data-rn-key='digit:0']").evaluate((slot) => {
    const probe = document.createElement("span");
    probe.id = "ink-probe";
    probe.style.cssText = "position:absolute;right:5px;top:45%;width:6px;height:6px;background:rgb(255,0,0)";
    slot.append(probe);
  });
  const pixel = async () => {
    const point = await page.locator("#ink-probe").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const frame = element.closest(".example-number")!.getBoundingClientRect();
      return { x: rect.x + 3, y: rect.y + 3, right: frame.right };
    });
    expect(point.x).toBeGreaterThan(point.right + 2);
    const png = (await page.screenshot()).toString("base64");
    return page.evaluate(async ({ png, point }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const scale = image.width / innerWidth;
      return [...context.getImageData(Math.round(point.x * scale), Math.round(point.y * scale), 1, 1).data];
    }, { png, point });
  };
  expect(await pixel()).toEqual([255, 0, 0, 255]);
  // Negative control: the old scrollport behavior reproduces the reported chop.
  await price.locator(".example-number").evaluate((element) => { element.style.overflowX = "auto"; element.style.overflowY = "hidden"; });
  expect(await pixel()).not.toEqual([255, 0, 0, 255]);
});
