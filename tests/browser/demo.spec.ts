import { expect, test } from "@playwright/test";

test("keeps the dark showcase and functional examples without marketing sections", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await page.locator("html").evaluate((element) => getComputedStyle(element).colorScheme)).toBe("dark");
  await expect(page.locator(".hero, .eyebrow, .research-section, .section-heading")).toHaveCount(0);
  const examples = page.locator("#examples article");
  await expect(examples).toHaveCount(4);
  await page.getByRole("button", { name: /Add a sale/ }).click();
  await expect(examples.nth(0).locator(".rn-semantic")).toHaveText("$8,365");
  await page.getByRole("button", { name: "Add 1", exact: true }).click();
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

test("hero motion blur can be turned off without changing the examples", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.locator(".number-frame .rn-smear").count()).toBeGreaterThan(0);
  await page.locator("summary").click();
  await page.getByLabel("Motion blur", { exact: true }).uncheck();
  await expect(page.locator(".rn-smear, .rn-blur-defs")).toHaveCount(0);
  await expect(page.locator("#examples .rn-smear")).toHaveCount(0);
});

test("eyes share their gaze and spin together as a smooth jackpot without squishing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".eyes")).toHaveAttribute("data-paused", "false");
  await expect.poll(() => page.locator(".eyes").evaluate((element) => element.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  const frame = (time: number) => page.locator(".eyes").evaluate((element, time) => {
    for (const animation of element.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; }
    return [...element.querySelectorAll(".eye-shell")].map((shell) => ({
      scale: new DOMMatrix(getComputedStyle(shell).transform).d,
      height: shell.querySelector("rect")!.getBoundingClientRect().height,
      reelY: new DOMMatrix(getComputedStyle(shell.querySelector(".eye-sharp")!).transform).f,
      smear: Number(getComputedStyle(shell.querySelector(".eye-smear")!).opacity),
      duration: parseFloat(getComputedStyle(shell.querySelector(".eye-sharp")!).animationDuration),
      pupilX: new DOMMatrix(getComputedStyle(shell.querySelector(".eye-look")!).transform).e,
      pupilY: new DOMMatrix(getComputedStyle(shell.querySelector(".eye-look")!).transform).f,
    }));
  }, time);
  // Engines differ on whether SVG bounds include the stroke; compare within each engine.
  const initial = await frame(0);
  for (const time of [600, 1800, 4200, 6000, 8200, 10000]) {
    for (const [index, eye] of (await frame(time)).entries()) {
      expect(eye.scale).toBe(1);
      expect(eye.height).toBeCloseTo(initial[index]!.height, 1);
    }
  }
  for (const time of [0, 600, 1200, 1900, 2640, 3000, 3600, 4200, 5100, 5900, 6600, 13900]) {
    const eyes = await frame(time);
    expect(eyes[0]?.pupilX).toBeCloseTo(eyes[1]!.pupilX, 4);
    expect(eyes[0]?.pupilY).toBeCloseTo(eyes[1]!.pupilY, 4);
    expect(eyes[0]?.reelY).toBeCloseTo(eyes[1]!.reelY, 4);
  }
  const rolling = await frame(3000);
  expect(rolling[0]?.duration).toBe(6);
  expect(rolling[0]?.reelY).toBeLessThan(-26);
  expect(rolling[0]?.reelY).toBeGreaterThan(-182);
  expect((await frame(4200))[0]?.reelY).toBeCloseTo(-182, 1);
  expect((await frame(2640))[0]?.smear).toBeGreaterThan(.5);
  await expect(page.locator(".eyes feGaussianBlur")).toHaveAttribute("stdDeviation", "0 1.1");
  const seams = await page.locator(".eyes").evaluate((element) => [...element.querySelectorAll(".eye-shell")].map((shell) => {
    const period = parseFloat(getComputedStyle(shell.querySelector(".eye-sharp")!).animationDuration) * 1000;
    const visiblePupil = (time: number) => {
      for (const animation of shell.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; }
      const bounds = shell.querySelector("rect")!.getBoundingClientRect();
      const center = bounds.y + bounds.height / 2;
      return [...shell.querySelectorAll(".eye-sharp circle")].map((circle) => {
        const box = circle.getBoundingClientRect();
        return box.y + box.height / 2;
      }).sort((a, b) => Math.abs(a - center) - Math.abs(b - center))[0] ?? Infinity;
    };
    return Math.abs(visiblePupil(period - .01) - visiblePupil(period + .01));
  }));
  for (const delta of seams) expect(delta).toBeLessThan(.1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".eyes")).toHaveAttribute("data-paused", "true");
  expect(await page.locator(".eyes").evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
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
