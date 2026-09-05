import { expect, test } from "@playwright/test";

declare global {
  interface Window { scrubProbe: { unrelatedFormats: number; inputs: number }; scrubPlayback: { age: number; time: number }[] }
}

test("dragging Scrub updates only its own counter and keeps keyboard input immediate", async ({ page }) => {
  await page.goto("/");
  const slider = page.getByRole("slider", { name: "Distance", exact: true });
  await slider.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const probe = window.scrubProbe = { unrelatedFormats: 0, inputs: 0 };
    const format = Intl.NumberFormat.prototype.formatToParts;
    Intl.NumberFormat.prototype.formatToParts = function (value) {
      if ([8240, 1204, 1987.65].includes(Number(value))) probe.unrelatedFormats++;
      return format.call(this, value ?? NaN);
    };
    document.querySelector('[aria-label="Distance"]')!.addEventListener("input", () => probe.inputs++);
  });
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * .4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2, { steps: 15 });
  await page.mouse.move(box.x + box.width * .3, box.y + box.height / 2, { steps: 15 });
  await page.mouse.up();
  const remaining = await page.locator(".scrub-number").evaluate((node) => Math.max(0, ...node.getAnimations({ subtree: true }).map((animation) => Number(animation.effect!.getComputedTiming().endTime) - Number(animation.currentTime))));
  expect(remaining).toBeLessThanOrEqual(180); // Direct manipulation should not trail by a third of a second.
  const value = Number(await slider.inputValue());
  await expect(page.locator(".scrub-number .rn-semantic")).toHaveText(`${new Intl.NumberFormat("en-US").format(value)} km`);
  const probe = await page.evaluate(() => window.scrubProbe);
  expect(probe.inputs).toBeGreaterThan(10);
  expect(probe.unrelatedFormats).toBe(0);
  await expect.poll(() => page.locator(".scrub-number").evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue(String(value + 1));
  await expect(page.locator(".scrub-number .rn-semantic")).toHaveText(`${new Intl.NumberFormat("en-US").format(value + 1)} km`);
  expect(await page.locator(".scrub-number").evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
});

test("continuous pointer input advances reels before retargeting them", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("slider", { name: "Distance", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.locator(".scrub-number .rn-root")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => {
    const canceled = window.scrubPlayback = [] as { age: number; time: number }[];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches(".scrub-number .rn-reel")) {
        const created = Number(document.timeline.currentTime);
        const cancel = animation.cancel.bind(animation);
        animation.cancel = () => {
          canceled.push({ age: Number(document.timeline.currentTime) - created, time: Number(animation.currentTime ?? 0) });
          cancel();
        };
      }
      return animation;
    };
  });
  const box = (await page.getByRole("slider", { name: "Distance", exact: true }).boundingBox())!;
  await page.mouse.move(box.x + box.width * .4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2, { steps: 80 });
  await page.mouse.move(box.x + box.width * .2, box.y + box.height / 2, { steps: 80 });
  await page.mouse.up();
  const result = await page.evaluate(() => {
    const eligible = window.scrubPlayback.filter((sample) => sample.age > 5);
    return { count: eligible.length, stalled: eligible.filter((sample) => sample.time === 0).length };
  });
  expect(result.count).toBeGreaterThan(30); // Engines coalesce native pointer moves differently.
  expect(result.stalled).toBe(0);
});

test("Scrub gets a stronger vertical smear only while its digits move", async ({ page }) => {
  await page.goto("/");
  const slider = page.getByRole("slider", { name: "Distance", exact: true });
  await slider.scrollIntoViewIfNeeded();
  const number = page.locator(".scrub-number");
  await expect(number.locator(".rn-root")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.closest(".scrub-number")) { animation.pause(); animation.currentTime = 0; }
      return animation;
    };
    const input = document.querySelector<HTMLInputElement>('[aria-label="Distance"]')!;
    input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "95724");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    for (const animation of document.querySelector(".scrub-number")!.getAnimations({ subtree: true })) animation.currentTime = 24;
    input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    Element.prototype.animate = animate;
  });
  const moving = await number.evaluate((root) => {
    const [x, y] = root.querySelector("feGaussianBlur")!.getAttribute("stdDeviation")!.split(" ").map(Number);
    const height = root.querySelector(".rn-slot .rn-face")!.getBoundingClientRect().height;
    return {
      x, deviation: y! / height,
      opacity: Math.max(...[...root.querySelectorAll(".rn-smear")].map((smear) => Number(getComputedStyle(smear).opacity))),
      symbolsBlurred: root.querySelectorAll(".rn-slot:not([data-rn-wheel]) .rn-smear").length,
    };
  });
  expect(moving.x).toBe(0);
  expect(moving.deviation).toBeCloseTo(.035 * 2.4, 3);
  expect(moving.opacity).toBeGreaterThan(.8);
  expect(moving.symbolsBlurred).toBe(0); // The comma and km suffix stay crisp.
  await number.evaluate((root) => { for (const animation of root.getAnimations({ subtree: true })) animation.finish(); });
  await expect(number.locator(".rn-smear, .rn-sharp")).toHaveCount(0);
  await expect(number.locator(".rn-semantic")).toHaveText("95,724 km");
  await slider.press("ArrowRight");
  await expect(number.locator(".rn-smear")).toHaveCount(0);
  expect(await number.evaluate((root) => root.getAnimations({ subtree: true }).length)).toBe(0);
});
