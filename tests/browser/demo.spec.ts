import { expect, test } from "@playwright/test";

test("keeps the dark showcase and functional examples without marketing sections", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme)).toBe("dark");
  await expect(page.locator(".hero, .eyebrow, .research-section, .section-heading")).toHaveCount(0);
  const examples = page.locator("#examples article");
  await expect(examples).toHaveCount(10);
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
  await page.getByRole("button", { name: "Options" }).click();
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

test("number containers keep horizontal overflow visible rather than truncating", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const frame = page.locator(".number-frame");
    await expect(frame.locator(".rn-react")).toHaveAttribute("data-rn-hydrated", "");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    for (const element of await page.locator(".number-frame, .example-number, .mini-app").all()) {
      expect(await element.evaluate((element) => getComputedStyle(element).overflowX)).toBe("visible");
    }
    await frame.locator(".rn-react").evaluate((element) => { element.style.minWidth = "2000px"; });
    expect(await frame.locator(".rn-react").evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(2000);
    expect(await frame.evaluate((element) => getComputedStyle(element).overflowX)).toBe("visible");
  }
});

test("install row slides its selection, animates the command width, copies, and links Markdown docs", async ({ page, context, browserName }) => {
  await page.goto("/");
  const install = page.locator(".install");
  await expect(install.locator("code")).toHaveText("bun add @kitlangton/rolling-number");
  const inset = () => install.locator(".segmented-highlight").evaluate((element) => Number(/inset\(\S+ \S+ \S+ (\S+)px/.exec(getComputedStyle(element).clipPath)![1]));
  expect(await inset()).toBeCloseTo(0, 0);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
  });
  const widthBefore = await install.locator("code").evaluate((element) => element.getBoundingClientRect().width);
  await install.getByRole("button", { name: "npm", exact: true }).click();
  await expect(install.locator("code")).toHaveText("npm install @kitlangton/rolling-number");
  // Paused at the start, both the pill clip and the width still show the previous state.
  expect(await inset()).toBeCloseTo(0, 0);
  expect(await install.locator("code").evaluate((element) => element.getBoundingClientRect().width)).toBeCloseTo(widthBefore, 0);
  const animations = await install.evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => (animation.effect as KeyframeEffect).getTiming().easing));
  expect(animations.length).toBeGreaterThanOrEqual(2);
  expect(animations.filter((easing) => easing?.startsWith("linear(")).length).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  const target = await install.getByRole("button", { name: "npm", exact: true }).evaluate((element) => (element as HTMLElement).offsetLeft);
  expect(await inset()).toBeCloseTo(target, 0);
  expect(await page.locator("link[rel='alternate'][type='text/markdown']").getAttribute("href")).toBe("/index.md");
  expect(await page.locator("footer a[href='./llms.txt']").count()).toBe(1);
  test.skip(browserName !== "chromium", "clipboard permissions are only scriptable in Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await install.getByRole("button", { name: "Copy install command" }).click();
  await expect(install.getByRole("button", { name: "Copy install command" })).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("npm install @kitlangton/rolling-number");
});

test("team avatars and the overflow count animate with the shared spring instead of popping", async ({ page }) => {
  await page.goto("/");
  const team = page.locator(".team-app");
  await team.scrollIntoViewIfNeeded();
  await expect(team.locator(".mini-avatar[data-present='true']")).toHaveCount(5);
  await expect(team.locator(".extra-members")).toHaveAttribute("data-present", "true");
  await expect(team.locator(".extra-members .rn-semantic")).toHaveText("3");
  const slider = page.locator("#seats");
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * .3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 1, box.y + box.height / 2, { steps: 2 });
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.pause(); });
  await page.mouse.up();
  await expect(team.locator(".mini-avatar[data-present='false']")).toHaveCount(4);
  const transitions = await team.locator(".mini-avatar[data-present='false']").first().evaluate((element) => element.getAnimations().map((animation) => (animation.effect as KeyframeEffect).getTiming().easing));
  expect(transitions.length).toBeGreaterThan(0);
  for (const easing of transitions) expect(easing).toMatch(/^linear\(/);
  // Mid-transition the departing avatar is still partially visible.
  await page.evaluate(() => { for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 40; } });
  const width = await team.locator(".mini-avatar[data-present='false']").first().evaluate((element) => element.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(0);
  expect(width).toBeLessThan(34);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  await expect.poll(() => team.locator(".mini-avatar[data-present='false']").first().evaluate((element) => element.getBoundingClientRect().width)).toBe(0);
  await expect(team.locator(".extra-members")).toHaveAttribute("data-present", "false");
});

test("the options panel reveals on the shared spring and is inert when closed", async ({ page }) => {
  await page.goto("/");
  const panel = page.locator("#settings");
  await expect(panel).toBeHidden();
  await expect(page.locator("#locale")).toHaveCount(1);
  expect(await page.evaluate(() => document.getElementById("settings")!.inert)).toBe(true);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
  });
  const toggle = page.getByRole("button", { name: "Options" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(await panel.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(1);
  const easings = await panel.evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => (animation.effect as KeyframeEffect).getTiming().easing));
  expect(easings.length).toBe(2);
  for (const easing of easings) expect(easing).toMatch(/^linear\(/);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.getElementById("settings")!.inert)).toBe(false);
  expect(await panel.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(100);
  await page.locator("#locale").focus();
  await toggle.click();
  expect(await panel.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(100);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  await expect(panel).toBeHidden();
});

test("rapid likes keep one rolling count and one replaced heart pop", async ({ page }) => {
  await page.goto("/");
  const tile = page.locator(".likes-app");
  await tile.scrollIntoViewIfNeeded();
  await expect(tile.locator(".rn-semantic")).toHaveText("1,204");
  const like = tile.getByRole("button", { name: "Like" });
  for (let index = 0; index < 5; index++) await like.click({ delay: 10 });
  await expect(tile.locator(".rn-semantic")).toHaveText("1,209");
  expect(await tile.locator(".heart svg").evaluate((element) => element.getAnimations().length)).toBeLessThanOrEqual(1);
  expect(await tile.locator(".heart svg").evaluate((element) => (element.getAnimations()[0]?.effect as KeyframeEffect | undefined)?.getTiming().easing ?? "linear(")).toMatch(/^linear\(/);
  await expect.poll(() => tile.locator(".rn-slot").count()).toBe(5);
});
