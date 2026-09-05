import { expect, test } from "@playwright/test";
import type {} from "../../demo/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
});

test("rolls, interrupts, settles and bounds retained DOM", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() => window.mountNumber({ value: 999.99, locales: "en-US", duration: 220 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const before = await page.locator(".rn-slot[data-rn-key='digit:0']").elementHandle();
  await page.evaluate(async () => {
    for (let index = 0; index < 60; index++) {
      window.testNumber.update({ value: index % 2 ? 1000.01 : -89.23 });
      await new Promise(requestAnimationFrame);
    }
    window.testNumber.update({ value: 1234.56 });
  });
  await expect(page.locator("#number > .rn-value")).toHaveText("1,234.56");
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await before?.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator(".rn-face")).toHaveCount(8);
  expect(await page.locator("#number *").count()).toBeLessThan(45);
  expect(errors).toEqual([]);
});

test("format changes retain digit places and animate symbol entry, replacement and exit", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 99.25, locales: "en-US", duration: 800 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const unit = await page.locator(".rn-slot[data-rn-key='digit:0']").elementHandle();
  for (const options of [
    { value: 12345.67, format: { style: "currency", currency: "USD" } },
    { value: 8.5, format: { style: "currency", currency: "EUR" } },
    { value: .42, format: { style: "percent" } },
    { value: -7, format: { maximumFractionDigits: 0 } },
  ] satisfies { value: number; format: Intl.NumberFormatOptions }[]) {
    await page.evaluate((options) => window.testNumber.update(options), options);
    await expect(page.locator("#number > .rn-value")).toHaveText(new Intl.NumberFormat("en-US", options.format).format(options.value));
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    expect(await unit?.evaluate((element) => element.isConnected)).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator(".rn-slot")).toHaveCount(2);
  await expect(page.locator(".rn-face")).toHaveCount(2);
});

for (const alignment of ["left", "center", "right"] as const) {
  test(`large width changes preserve visible positions and reveal new digits from below (${alignment})`, async ({ page }) => {
    await page.evaluate((alignment) => {
      document.getElementById("fixture")!.style.textAlign = alignment;
      window.mountNumber({ value: 23, locales: "en-US", format: { style: "currency", currency: "USD" }, duration: 600 });
    }, alignment);
    await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
    const state = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>(".rn-slot")].map((element) => [element.dataset.rnKey!, element.getBoundingClientRect().x])));
    const before = await state();
    await page.evaluate(async () => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        animation.pause(); animation.currentTime = 0;
        return animation;
      };
      window.testNumber.update({ value: 5823823 });
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const start = await state();
    for (const key of Object.keys(before)) expect(Math.abs(start[key]! - before[key]!)).toBeLessThan(.5);
    const entrance = await page.locator(".rn-slot[data-rn-key='digit:6']").evaluate((slot) => ({
      viewportBottom: slot.getBoundingClientRect().bottom,
      glyphTop: slot.querySelector(".rn-face")!.getBoundingClientRect().top,
    }));
    expect(entrance.glyphTop).toBeGreaterThanOrEqual(entrance.viewportBottom - .5);
    // New places cascade outward from the retained "2" and "3": the adjacent "8"
    // leads, each comma takes its own step, and the leading "5" is last.
    const delays = await page.evaluate(() => ["digit:2", "group:3:,", "digit:3", "digit:4", "digit:5", "group:6:,", "digit:6"].map((key) => {
      const slot = document.querySelector<HTMLElement>(`.rn-slot[data-rn-key='${key}']`)!;
      const fade = slot.getAnimations().find((animation) => (animation.effect as KeyframeEffect).getKeyframes().some((frame) => "opacity" in frame))!;
      return Number(fade.effect!.getComputedTiming().duration) - (key.startsWith("group") ? 180 : 600);
    }));
    expect(delays[0]).toBe(0);
    for (let index = 1; index < delays.length; index++) expect(delays[index]!).toBeGreaterThan(delays[index - 1]!);
    expect(delays.at(-1)!).toBeLessThanOrEqual(180);
    await page.evaluate(() => { for (const animation of document.getAnimations()) animation.currentTime = 240; });
    const interrupted = await state();
    await page.evaluate(async () => {
      window.testNumber.update({ value: 42 });
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    const reversed = await state();
    // Places still waiting in their stagger hold are invisible and may leave at once.
    expect(Object.keys(reversed).length).toBeGreaterThan(8);
    for (const key of Object.keys(reversed)) expect(Math.abs(reversed[key]! - interrupted[key]!)).toBeLessThan(.5);
    await page.evaluate(() => window.testNumber.finish());
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
}

test("currency replacements crossfade in place instead of entering through the digits", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 1987.65, locales: "en-US", format: { style: "currency", currency: "USD" }, duration: 600, motionBlur: true }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const oldSymbol = page.locator("[data-rn-key='currency:0:$']");
  const before = await oldSymbol.boundingBox();
  await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
    window.testNumber.update({ format: { style: "currency", currency: "GBP" } });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const nextSymbol = page.locator("[data-rn-key='currency:0:£']");
  expect(Math.abs((await nextSymbol.boundingBox())!.x - before!.x)).toBeLessThan(.5);
  await expect(nextSymbol.locator(".rn-enter, .rn-smear")).toHaveCount(0);
  expect(await nextSymbol.evaluate((element) => getComputedStyle(element).maskImage)).toBe("none");
  expect(await nextSymbol.locator(".rn-reel").evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a)).toBeCloseTo(.96, 3);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.currentTime = 90; });
  const oldAlpha = await oldSymbol.evaluate((element) => Number(getComputedStyle(element).opacity));
  const newAlpha = await nextSymbol.evaluate((element) => Number(getComputedStyle(element).opacity));
  expect(oldAlpha + newAlpha).toBeCloseTo(1, 3);
  expect(await oldSymbol.locator(".rn-reel").evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a)).toBeGreaterThan(1);
  await page.evaluate(() => window.testNumber.finish());
});

test("same formatted value does not restart animations", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 1, duration: 600, format: { maximumFractionDigits: 0 } }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => window.testNumber.update({ value: 8 }));
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
  const stable = await page.evaluate(() => {
    const animations = document.getAnimations();
    window.testNumber.update({ value: 8.01 });
    return animations.every((animation) => document.getAnimations().includes(animation));
  });
  expect(stable).toBe(true);
});

test("fades reel edges with a configurable linear mask", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 3257.52, duration: 800 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const slot = page.locator(".rn-slot").first();
  const mask = await slot.evaluate((element) => getComputedStyle(element).maskImage);
  expect(mask).toContain("linear-gradient");
  expect(mask).toContain("rgba(0, 0, 0, 0)");
  await page.locator("#number").evaluate((element) => element.style.setProperty("--rn-edge-fade", "12px"));
  expect(await slot.evaluate((element) => getComputedStyle(element).maskImage)).toContain("12px");
  await page.locator("#number").evaluate((element) => element.style.setProperty("--rn-mask", "none"));
  expect(await slot.evaluate((element) => getComputedStyle(element).maskImage)).toBe("none");
});

test("native playback does not read geometry each frame", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 1, duration: 800 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => window.testNumber.update({ value: 8 }));
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
  const reads = await page.evaluate(async () => {
    const original = Element.prototype.getBoundingClientRect;
    let count = 0;
    Element.prototype.getBoundingClientRect = function () { count++; return original.call(this); };
    try {
      for (let frame = 0; frame < 8; frame++) await new Promise(requestAnimationFrame);
      return count;
    } finally { Element.prototype.getBoundingClientRect = original; }
  });
  expect(reads).toBe(0);
});

test("uses compact native keyframes and retains a legacy easing fallback", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 1, duration: 800 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => window.testNumber.update({ value: 8 }));
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
  const frames = await page.evaluate(() => document.getAnimations().map((animation) => (animation.effect as KeyframeEffect).getKeyframes().length));
  expect(frames.every((count) => count === 2)).toBe(true);
  await page.addInitScript(() => { CSS.supports = () => false; });
  await page.reload();
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountNumber({ value: 1, duration: 800 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => window.testNumber.update({ value: 8 }));
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
  const fallback = await page.evaluate(() => document.getAnimations().map((animation) => (animation.effect as KeyframeEffect).getKeyframes().length));
  expect(fallback.every((count) => count === 49)).toBe(true);
});

test("retargets from the visible wheel position without snapping", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 1, duration: 500 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => window.testNumber.update({ value: 8 }));
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
  const delta = await page.evaluate(async () => {
    for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 150; }
    const visible = () => {
      const slot = document.querySelector(".rn-slot")!;
      const viewport = slot.getBoundingClientRect();
      return [...slot.querySelectorAll(".rn-face")].flatMap((face) => {
        const rect = face.getBoundingClientRect();
        return rect.bottom > viewport.top + 1 && rect.top < viewport.bottom - 1
          ? [{ text: face.textContent, y: rect.top }] : [];
      });
    };
    const before = visible();
    window.testNumber.update({ value: 2 });
    await new Promise(requestAnimationFrame);
    for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = 0; }
    const after = visible();
    return Math.max(...before.map((face) => Math.abs(face.y - (after.find((entry) => entry.text === face.text)?.y ?? Infinity))));
  });
  expect(delta).toBeLessThan(0.5);
});

test("opacity overshoot retains its non-linear clamped trajectory", async ({ page }) => {
  const result = await page.evaluate(() => window.opacityProbe());
  expect(result.expected).toBeLessThan(1);
  expect(result.actual).toBeCloseTo(result.expected, 3);
});

test("invalid updates are atomic and finishing releases playback", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 19, duration: 500 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const rejected = await page.evaluate(() => {
    try { window.testNumber.update({ value: 90, duration: NaN }); return false; }
    catch { return true; }
  });
  expect(rejected).toBe(true);
  await expect(page.locator("#number > .rn-value")).toHaveText("19");
  await page.evaluate(() => { window.testNumber.update({ value: 91 }); window.testNumber.finish(); });
  await expect(page.locator("#number > .rn-value")).toHaveText("91");
  await expect(page.locator("#number > .rn-value")).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("recovers geometry when a hidden counter becomes visible", async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById("fixture")!.style.display = "none";
    window.mountNumber({ value: 42, pauseOffscreen: true });
  });
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  await page.locator("#fixture").evaluate((element) => { element.style.display = "block"; });
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await expect(page.locator(".rn-face")).toHaveCount(2);
});

test("width changes from animation-frame callbacks still animate", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 99, duration: 1000 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => {
    window.testNumber.update({ value: 100 });
    requestAnimationFrame(() => resolve());
  })));
  expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
});

test("keeps native text order in RTL surrounding layout", async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById("fixture")!.dir = "rtl";
    window.mountNumber({ value: -123, locales: "en-US" });
  });
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  await expect(page.locator("#number")).not.toHaveAttribute("data-rn-ready", "");
  await expect(page.locator("#number > .rn-value")).toBeVisible();
  await expect(page.locator("#number > .rn-value")).toHaveText("-123");
});

test("reappearing counters recover even with offscreen pausing disabled", async ({ page }) => {
  await page.evaluate(() => {
    document.getElementById("fixture")!.style.display = "none";
    window.mountNumber({ value: 42, pauseOffscreen: false });
  });
  await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  await page.locator("#fixture").evaluate((element) => { element.style.display = "block"; });
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
});

test("preserves React 19 callback-ref cleanup", async ({ page }) => {
  await page.evaluate(() => window.mountRefProbe());
  await expect(page.locator(".rn-react")).toHaveCount(1);
  await page.evaluate(() => window.unmountReact());
  const probe = await page.evaluate(() => window.refProbe);
  expect(probe.mounted).toBeGreaterThan(0);
  expect(probe.cleaned).toBe(probe.mounted);
  expect(probe.nullCalls).toBe(0);
});

test("reduced motion changes settle immediately and remain accessible", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 8, duration: 1000 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => window.testNumber.update({ value: 123 }));
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator("#number > .rn-value")).toBeVisible();
  expect(await page.locator("#number").ariaSnapshot()).toBe('- text: "123"');
});

test("tracks font size and proportional glyph widths", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: 111.88 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.locator("#number").evaluate((element) => {
    element.style.fontVariantNumeric = "normal";
    element.style.fontSize = "91px";
    element.style.fontStyle = "italic";
  });
  await expect.poll(() => page.evaluate(() => {
    const measure = document.querySelector(".rn-token")?.getBoundingClientRect();
    const slot = document.querySelector(".rn-slot")?.getBoundingClientRect();
    return Math.abs((measure?.height ?? 0) - (slot?.height ?? 100));
  })).toBeLessThan(1);
  await page.screenshot({ path: "test-results/proportional.png" });
});

test("preserves RTL text and bigint, and destroys cleanly", async ({ page }) => {
  await page.evaluate(() => window.mountNumber({ value: -1234.5, locales: "ar-EG", format: { style: "currency", currency: "USD" } }));
  const text = await page.evaluate(() => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "USD" }).format(-1234.5));
  await expect(page.locator("#number > .rn-value")).toHaveText(text);
  await expect(page.locator("#number > .rn-value")).toBeVisible();
  await page.evaluate(() => window.testNumber.update({ value: 900719925474099312345n, locales: "en-US", format: { useGrouping: false } }));
  await expect(page.locator("#number > .rn-value")).toHaveText("900719925474099312345");
  await page.evaluate(() => { window.testNumber.destroy(); window.testNumber.destroy(); });
  await expect(page.locator("#number")).toHaveText("900719925474099312345");
  expect(await page.locator("#number *").count()).toBe(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("hydrates React under StrictMode, updates, and unmounts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.evaluate(() => window.reactNumber({ value: 129, locales: "en-US", duration: 200 }, true));
  await expect(page.locator("#react-number")).toHaveAttribute("data-rn-hydrated", "");
  await page.evaluate(() => window.reactNumber({ value: 130, locales: "en-US", duration: 200 }));
  await expect(page.locator(".rn-semantic")).toHaveText("130");
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.locator("#react-number").ariaSnapshot()).toBe('- text: "130"');
  await page.evaluate(() => window.unmountReact());
  await expect(page.locator("#fixture")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("flap mode hinges bounded half cards, resumes from a mid-flip interruption and cleans up", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountNumber({ value: 8, mode: "flap", direction: "up", duration: 700, locales: "en-US" }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
    window.testNumber.update({ value: 1 });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const slot = page.locator("[data-rn-key='digit:0']");
  await expect(slot).toHaveAttribute("data-rn-flap", "");
  // 8 → 1 going up is three steps (8, 9, 0 → 1), represented by four fixed planes.
  // The next-face strips repeat their target so it remains painted before cleanup.
  await expect(slot.locator(".rn-flap")).toHaveCount(4);
  expect(await slot.locator(".rn-flap-top").evaluateAll((cards) => cards.map((card) => card.textContent!.split("\n")))).toEqual([["9", "0", "1", "1"], ["8", "9", "0", "1"]]);
  expect(await slot.locator(".rn-flap-bottom").evaluateAll((cards) => cards.map((card) => card.textContent!.split("\n")))).toEqual([["8", "9", "0", "1"], ["9", "0", "1", "1"]]);
  const cadence = await slot.locator(".rn-flap-top").last().evaluate((card) => {
    const effect = card.getAnimations()[0]!.effect as KeyframeEffect;
    return Number(effect.getComputedTiming().duration) * effect.getKeyframes()[1]!.computedOffset * 2;
  });
  expect(cadence).toBeGreaterThanOrEqual(45);
  expect(cadence).toBeLessThanOrEqual(110);
  // Advance into the second card, then retarget: the sequence restarts from the nearer face.
  await page.evaluate((cadence) => { for (const animation of document.getAnimations()) animation.currentTime = cadence * 1.4; }, cadence);
  await page.evaluate(async () => {
    window.testNumber.update({ value: 3 });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const tops = await slot.locator(".rn-flap-top").evaluateAll((cards) => cards.map((card) => card.textContent));
  expect(tops.at(-1)!.split("\n")).toEqual(["9", "0", "1", "2", "3"]);
  expect(tops.length).toBe(2);
  await page.evaluate(() => window.testNumber.finish());
  await expect(slot.locator(".rn-flap")).toHaveCount(0);
  await expect(page.locator("#number > .rn-value")).toHaveText("3");
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
