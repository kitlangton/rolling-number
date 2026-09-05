import { expect, test, type Page } from "@playwright/test";
import type {} from "../../demo/test";

declare global {
  interface Window {
    audioProbe: { contexts: AudioContext[]; starts: number; active: number; peak: number; gains: number[] };
  }
}

async function mountSoundFixture(page: Page) {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(async () => {
    const path = "/board-sound.ts";
    const { createBoardSound } = await import(path);
    const state = document.createElement("output"); state.id = "sound-state";
    const toggle = document.createElement("button"); toggle.textContent = "Toggle audio";
    const destroy = document.createElement("button"); destroy.textContent = "Destroy audio";
    const controller = createBoardSound(document.getElementById("fixture")!, (value: string) => { state.textContent = value; });
    toggle.onclick = () => void controller.toggle();
    destroy.onclick = () => { controller.destroy(); state.textContent = "destroyed"; };
    document.body.append(state, toggle, destroy);
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = AudioContext;
    const probe = window.audioProbe = { contexts: [] as AudioContext[], starts: 0, active: 0, peak: 0, gains: [] as number[] };
    window.AudioContext = class extends NativeAudioContext {
      constructor() { super(); probe.contexts.push(this); }
      override createGain() {
        const gain = super.createGain();
        const connect = gain.connect.bind(gain);
        gain.connect = ((destination: AudioNode) => { probe.gains.push(gain.gain.value); return connect(destination); }) as typeof gain.connect;
        return gain;
      }
      override createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args) => {
          probe.starts++; probe.active++; probe.peak = Math.max(probe.peak, probe.active);
          source.addEventListener("ended", () => probe.active--, { once: true });
          start(...args);
        };
        return source;
      }
    };
    // Keep the clock still without virtualizing native animation or audio time.
    const NativeDate = Date;
    globalThis.Date = new Proxy(NativeDate, {
      construct: (target, args) => Reflect.construct(target, args.length ? args : ["2026-09-04T12:00:00Z"]),
    });
    Math.random = () => .314159;
  });
});

test("sound is opt-in, grouped, interruptible, and quiet when the board settles", async ({ page }) => {
  test.setTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/board.html?renderer=dom");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const sound = page.getByRole("button", { name: "Sound", exact: true });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(0);
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe("running");
  expect(await page.evaluate(() => window.audioProbe.starts)).toBe(0);
  await page.getByRole("button", { name: "Next PR" }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.starts)).toBeGreaterThan(2);
  await page.getByRole("button", { name: "Next PR" }).click();
  await expect(page.locator(".rn-flap")).toHaveCount(0, { timeout: 12000 });
  await expect.poll(() => page.evaluate(() => window.audioProbe.active)).toBe(0);
  const settled = await page.evaluate(() => ({ starts: window.audioProbe.starts, peak: window.audioProbe.peak, gains: window.audioProbe.gains }));
  expect(settled.peak).toBeLessThanOrEqual(8);
  expect(Math.max(...settled.gains)).toBeLessThanOrEqual(.121);
  expect(new Set(settled.gains).size).toBeGreaterThan(2); // Density follows the number of moving drums.
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.audioProbe.starts)).toBe(settled.starts);
  await page.getByRole("button", { name: "Next PR" }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.starts)).toBeGreaterThan(settled.starts);
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe("suspended");
  const muted = await page.evaluate(() => window.audioProbe.starts);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.audioProbe.starts)).toBe(muted);
  await sound.click();
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(1);
  await page.getByRole("checkbox", { name: "Reduce motion" }).check();
  await expect(sound).toBeDisabled();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".rn-flap")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("hiding the page mutes audio and requires explicit re-enabling", async ({ page }) => {
  await page.goto("/board.html?renderer=dom");
  const sound = page.getByRole("button", { name: "Sound", exact: true });
  await sound.click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe("suspended");
  await expect(sound).toHaveAttribute("aria-pressed", "false");
});

test("unavailable audio preserves the working, readable board", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "AudioContext", { value: undefined }); });
  await page.goto("/board.html?renderer=dom");
  await page.getByRole("button", { name: "Sound", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Audio is unavailable/);
  await expect(page.getByRole("button", { name: "Sound", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("tbody tr")).toHaveCount(6);
});

test("destroying during audio startup closes the context without re-enabling sound", async ({ page }) => {
  await mountSoundFixture(page);
  await page.evaluate(() => {
    let release = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = async function () { await resume.call(this); await pending; };
    const destroy = [...document.querySelectorAll("button")].find((button) => button.textContent === "Destroy audio")!;
    destroy.addEventListener("click", () => release());
  });
  await page.getByRole("button", { name: "Toggle audio", exact: true }).click();
  await page.getByRole("button", { name: "Destroy audio", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe("closed");
  await expect(page.locator("#sound-state")).toHaveText("destroyed");
  expect(await page.evaluate(() => window.audioProbe.starts)).toBe(0);
});

for (const result of ["resolve", "reject"] as const) {
  test(`an obsolete audio startup cannot ${result} over the newest toggle`, async ({ page }) => {
    await mountSoundFixture(page);
    await page.evaluate((result) => {
      let release = () => {};
      const pending = new Promise<void>((resolve, reject) => { release = result === "resolve" ? resolve : () => reject(new Error("Old startup failed")); });
      const resume = AudioContext.prototype.resume;
      let calls = 0;
      AudioContext.prototype.resume = function () {
        const resumed = resume.call(this);
        return ++calls === 1 ? resumed.then(() => pending) : resumed;
      };
      const state = document.getElementById("sound-state")!;
      let observations = 0;
      const observe = MutationObserver.prototype.observe;
      MutationObserver.prototype.observe = function (...args) {
        state.dataset.observations = String(++observations);
        observe.apply(this, args);
      };
      const releaseButton = document.createElement("button"); releaseButton.textContent = "Release old startup";
      releaseButton.onclick = release;
      document.body.append(releaseButton);
    }, result);
    const toggle = page.getByRole("button", { name: "Toggle audio", exact: true });
    await toggle.click(); await toggle.click(); await toggle.click();
    await expect(page.locator("#sound-state")).toHaveAttribute("data-observations", "1");
    await page.getByRole("button", { name: "Release old startup" }).click();
    await page.waitForTimeout(100);
    await expect(page.locator("#sound-state")).toHaveText("on");
    await expect(page.locator("#sound-state")).toHaveAttribute("data-observations", "1");
    expect(await page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe("running");
  });
}

test("sound can join an older moving drum and destroy releases active audio", async ({ page }) => {
  await mountSoundFixture(page);
  await page.evaluate(() => window.mountText({ text: "A", charset: "ABCDEFGHIJKLMNOPQRSTU", mode: "flap", duration: 770, stagger: "none" }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  await page.evaluate(() => window.testText.update({ text: "U" }));
  await page.waitForFunction(() => Number(document.querySelector(".rn-reel")?.getAnimations()[0]?.currentTime) > 600);
  expect(await page.locator(".rn-flap-bottom").last().evaluate((card) => (card.getAnimations()[0]!.effect as KeyframeEffect).getKeyframes().length)).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Toggle audio", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.starts), { timeout: 1000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Destroy audio", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe("closed");
  const starts = await page.evaluate(() => window.audioProbe.starts);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.audioProbe.starts)).toBe(starts);
});
