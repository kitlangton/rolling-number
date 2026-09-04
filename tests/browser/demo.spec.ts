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

test("typed values animate and still respect reduced motion", async ({ page }) => {
  await page.goto("/");
  const number = page.locator(".number-frame .rn-root");
  await expect(number).toHaveAttribute("data-rn-ready", "");
  await page.getByLabel("Number value").fill("1233");
  await expect(page.locator(".number-frame .rn-semantic")).toHaveText("1,233.00");
  await expect.poll(() => number.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("Number value").fill("4567");
  await expect(page.locator(".number-frame .rn-semantic")).toHaveText("4,567.00");
  expect(await number.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test("fixed eye capsules roll at independent rates without blinking or squishing", async ({ page }) => {
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
  const different = await frame(6000);
  expect(different[0]?.duration).toBe(9.4);
  expect(different[1]?.duration).toBe(7.1);
  expect(different[0]?.reelY).not.toBe(different[1]?.reelY);
  expect((await frame(4200))[0]?.smear).toBeGreaterThan(.5);
  await expect(page.locator("feGaussianBlur")).toHaveAttribute("stdDeviation", "0 1.1");
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
