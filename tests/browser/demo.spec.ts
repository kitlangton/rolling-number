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

test("eyes blink, look, blur vertically, turn into numbers and blink back", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".eyes")).toHaveAttribute("data-paused", "false");
  await expect.poll(() => page.locator(".eyes").evaluate((element) => element.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  const frame = (time: number) => page.locator(".eyes").evaluate((element, time) => {
    for (const animation of element.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; }
    const transform = (selector: string) => new DOMMatrix(getComputedStyle(element.querySelector(selector)!).transform);
    return {
      lid: transform(".eye-blink").d,
      pupilX: transform(".eye-look").e,
      pupilY: transform(".eye-look").f,
      reelY: transform(".eye-sharp").f,
      smear: Number(getComputedStyle(element.querySelector(".eye-smear")!).opacity),
    };
  }, time);
  expect((await frame(600)).lid).toBeLessThan(.1);
  const look = await frame(1800);
  expect(look.lid).toBe(1);
  expect(Math.abs(look.pupilX) + Math.abs(look.pupilY)).toBeGreaterThan(2);
  expect((await frame(4800)).smear).toBeGreaterThan(.5);
  await expect(page.locator("feGaussianBlur")).toHaveAttribute("stdDeviation", "0 1.1");
  expect((await frame(6600)).reelY).toBeCloseTo(-52, 1);
  expect((await frame(8200)).lid).toBeLessThan(.1);
  const end = await frame(9000);
  expect(end.lid).toBe(1);
  expect(end.reelY).toBe(0);
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
