import { expect, test } from "@playwright/test";

test("keeps the dark showcase and functional examples without marketing sections", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme)).toBe("dark");
  await expect(page.locator(".hero, .eyebrow, .research-section, .section-heading")).toHaveCount(0);
  const examples = page.locator("#examples article");
  await expect(examples).toHaveCount(8);
  await expect(page.locator(".brand h1")).toHaveText("rolling number");
  await expect(page.locator(".brand svg")).toHaveCount(0);
  await page.getByRole("button", { name: "Buy Studio tee" }).click();
  await expect(examples.nth(0).locator(".rn-semantic")).toHaveText("$8,365");
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  await expect(examples.nth(3).locator(".rn-semantic")).toHaveText("9,007,199,254,740,994");
});

test("the showcase measures elapsed milliseconds rather than inventing increments", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-04T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-04T12:00:01Z"));
  await page.goto("/");
  await page.clock.runFor(32);
  const number = page.locator(".number-frame .rn-root");
  await expect(number).toHaveAttribute("data-rn-ready", "");
  await expect(page.locator("#number-value, .value-control, .play-actions")).toHaveCount(0);
  await expect(page.locator(".number-frame .rn-semantic")).toHaveText("0 ms");
  await page.clock.runFor(1);
  await expect(page.locator(".number-frame .rn-semantic")).toHaveText("33 ms");
  for (const value of [66, 99, 132]) {
    await page.clock.runFor(33);
    await expect(page.locator(".number-frame .rn-semantic")).toHaveText(`${value} ms`);
  }
  await expect.poll(() => number.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await page.clock.fastForward(9000);
  await expect(page.locator(".number-frame .rn-semantic")).toHaveText("9,132 ms");
  const colors = await number.evaluate((element) => ({
    unit: getComputedStyle(element.querySelector("[data-rn-key^='unit:']")!).color,
    digit: getComputedStyle(element.querySelector("[data-rn-key='digit:0']")!).color,
  }));
  expect(colors.unit).not.toBe(colors.digit);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.fastForward(1000);
  await expect(page.locator(".number-frame .rn-semantic")).toHaveText("10,132 ms");
  expect(await number.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test("one motion-blur toggle controls the hero and examples", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/");
  await expect.poll(() => page.locator(".number-frame .rn-smear").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Buy Studio tee" }).click();
  await expect.poll(() => page.locator("#examples article").first().locator(".rn-smear").count()).toBeGreaterThan(0);
  await page.locator("summary").click();
  await page.getByLabel("Motion blur", { exact: true }).uncheck();
  await expect(page.locator(".rn-smear, .rn-blur-defs")).toHaveCount(0);
  await expect(page.locator("#examples .rn-smear")).toHaveCount(0);
});

test("the price suffix follows width changes without snapping", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/");
  const price = page.locator(".price");
  await expect(price.locator(".rn-root")).toHaveAttribute("data-rn-ready", "");
  const suffix = price.locator(":scope > span");
  const before = await suffix.evaluate((element) => element.getBoundingClientRect().x);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
  });
  const slider = page.locator("#seats");
  const box = (await slider.boundingBox())!;
  await slider.click({ position: { x: box.width - 1, y: box.height / 2 } });
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  await expect(price.locator(".rn-semantic")).toHaveText("$288");
  expect(Math.abs(await suffix.evaluate((element) => element.getBoundingClientRect().x) - before)).toBeLessThan(.5);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.currentTime = 150; });
  const interrupted = await suffix.evaluate((element) => element.getBoundingClientRect().x);
  await slider.click({ position: { x: 1, y: box.height / 2 } });
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  await expect(price.locator(".rn-semantic")).toHaveText("$12");
  expect(Math.abs(await suffix.evaluate((element) => element.getBoundingClientRect().x) - interrupted)).toBeLessThan(.5);
});

test("a purchase brightens immediately, fades for 1.8 seconds and replaces the previous flash", async ({ page }) => {
  await page.goto("/");
  const number = page.locator(".revenue-number");
  const idle = await number.evaluate((element) => getComputedStyle(element).color);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches(".revenue-number")) { animation.pause(); animation.currentTime = 0; }
      return animation;
    };
  });
  const button = page.getByRole("button", { name: "Buy Studio tee" });
  await button.click();
  await expect(number).toHaveCSS("color", "rgb(255, 255, 255)");
  const first = await number.evaluateHandle((element) => element.getAnimations()[0]!);
  expect(await first.evaluate((animation) => animation.effect!.getTiming().duration)).toBe(1800);
  await first.evaluate((animation) => { animation.currentTime = 900; });
  const halfway = await number.evaluate((element) => getComputedStyle(element).color);
  expect(halfway).not.toBe(idle);
  expect(halfway).not.toBe("rgb(255, 255, 255)");
  await button.click();
  expect(await first.evaluate((animation) => animation.playState)).toBe("idle");
  expect(await number.evaluate((element) => element.getAnimations().length)).toBe(1);
  await expect(number).toHaveCSS("color", "rgb(255, 255, 255)");
  await number.evaluate((element) => element.getAnimations()[0]!.finish());
  await expect.poll(() => number.evaluate((element) => element.getAnimations().length)).toBe(0);
  await expect(number).toHaveCSS("color", idle);
  await expect(number.locator(".rn-semantic")).toHaveText("$8,490");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  await button.click();
  expect(await number.evaluate((element) => element.getAnimations().length)).toBe(0);
});

test("extra examples cover percentages, signs, currency changes and large growth", async ({ page }) => {
  await page.goto("/");
  const example = (name: string) => page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await page.getByRole("button", { name: "Upload chunk", exact: true }).click();
  await expect(example("Upload").locator(".rn-semantic")).toHaveText("74%");
  await page.getByRole("button", { name: "Warm up", exact: true }).click();
  await expect(example("Weather").locator(".rn-semantic")).toHaveText("+0.5°C");
  await page.getByRole("button", { name: "EUR", exact: true }).click();
  await expect(example("Invoice").locator(".rn-semantic")).toHaveText("€1,987.65");
  await page.getByRole("button", { name: "JPY", exact: true }).click();
  await expect(example("Invoice").locator(".rn-semantic")).toHaveText("¥1,988");
  await page.getByRole("button", { name: "Go viral", exact: true }).click();
  await expect(example("Audience").locator(".rn-semantic")).toHaveText("5,823,823");
  await page.getByRole("button", { name: "Reset audience", exact: true }).click();
  await expect(example("Audience").locator(".rn-semantic")).toHaveText("23");
});

test("number displays hide scrollbars without disabling horizontal panning", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const frame = page.locator(".number-frame");
    await expect(frame.locator(".rn-react")).toHaveAttribute("data-rn-hydrated", "");
    await frame.locator(".rn-react").evaluate((element) => { element.style.minWidth = "2000px"; });
    const scroll = await frame.evaluate((element) => {
      element.scrollLeft = 100;
      return {
        scrollable: element.scrollWidth > element.clientWidth,
        scrollbar: getComputedStyle(element).scrollbarWidth,
        position: element.scrollLeft,
      };
    });
    expect(scroll.scrollable).toBe(true);
    expect(scroll.scrollbar).toBe("none");
    expect(scroll.position).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    for (const example of await page.locator(".example-number").all()) {
      expect(await example.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe("none");
    }
  }
});
