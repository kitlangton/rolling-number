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
