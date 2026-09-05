import { expect, test } from "@playwright/test";
import type {} from "../../demo/test";

test("bottom cards land on the new glyph before sequence cleanup", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = ".rn-face { background: #171a1f; color: #e6e2d6; }";
    document.head.append(style);
    document.body.style.background = "#171a1f";
    window.mountText({ text: "A", charset: "AB", mode: "flap", duration: 700, stagger: "none" });
    document.getElementById("number")!.style.font = "64px/1 monospace";
  });
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const box = (await page.locator(".rn-slot").boundingBox())!;
  const clip = { x: Math.ceil(box.x), y: Math.ceil(box.y + box.height / 2 + 2), width: Math.floor(box.width), height: Math.floor(box.height / 2 - 2) };
  const oldBottom = (await page.screenshot({ clip })).toString("base64");
  const angles = await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      return animation;
    };
    window.testText.update({ text: "B" });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const bottom = [...document.querySelectorAll<HTMLElement>(".rn-flap-bottom")].find((card) => card.getAnimations().length)!;
    const animation = bottom.getAnimations()[0]!;
    const timing = animation.effect!.getTiming();
    const angle = () => Math.acos(Math.max(-1, Math.min(1, new DOMMatrix(getComputedStyle(bottom).transform).m22))) * 180 / Math.PI;
    const waiting = angle();
    animation.currentTime = Number(timing.delay);
    const starting = angle();
    // Advance the cards only. Leave the logical reel track paused so cleanup
    // cannot replace the cards and conceal an incorrectly painted lower half.
    for (const card of document.querySelectorAll(".rn-flap")) {
      for (const effect of card.getAnimations()) effect.currentTime = Number(timing.delay) + Number(timing.duration);
    }
    return { waiting, starting, landed: angle() };
  });
  const landedBottom = (await page.screenshot({ clip })).toString("base64");
  await expect(page.locator(".rn-flap")).toHaveCount(4);
  await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
  await expect(page.locator(".rn-flap")).toHaveCount(0);
  const settledBottom = (await page.screenshot({ clip })).toString("base64");
  const pixels = await page.evaluate(async ({ oldBottom, landedBottom, settledBottom }) => {
    const decode = async (png: string) => {
      const image = new Image(); image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    };
    const [old, landed, settled] = await Promise.all([decode(oldBottom), decode(landedBottom), decode(settledBottom)]);
    const error = (data: Uint8ClampedArray) => data.reduce((sum, value, index) => sum + Math.abs(value - settled![index]!), 0) / (data.length * 255);
    return { old: error(old!), landed: error(landed!) };
  }, { oldBottom, landedBottom, settledBottom });
  expect(angles.waiting).toBeCloseTo(90, 2);
  expect(angles.starting).toBeCloseTo(90, 2);
  expect(angles.landed).toBeCloseTo(0, 2);
  expect(pixels.old).toBeGreaterThan(.02); // Negative control: A and B have different lower halves.
  expect(pixels.landed).toBeLessThan(.015);
  expect(pixels.landed).toBeLessThan(pixels.old / 10);
});

for (const { motionBlur, strength, blurred } of [
  { motionBlur: true, strength: "1", blurred: true },
  { motionBlur: true, strength: "0", blurred: false },
  { motionBlur: false, strength: "1", blurred: false },
]) {
  test(`flap softness follows the turning card (blur=${motionBlur}, strength=${strength})`, async ({ page }) => {
    await page.goto("/test.html");
    await page.waitForFunction(() => window.ready);
    await page.evaluate(({ motionBlur, strength }) => {
      window.mountText({ text: "A", charset: "AB", mode: "flap", duration: 700, stagger: "none", motionBlur });
      document.getElementById("number")!.style.setProperty("--rn-blur", strength);
    }, { motionBlur, strength });
    await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
    const result = await page.evaluate(async () => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        animation.pause(); animation.currentTime = 0;
        return animation;
      };
      window.testText.update({ text: "B" });
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const top = [...document.querySelectorAll<HTMLElement>(".rn-flap-top")].find((card) => card.getAnimations().length)!;
      const bottom = [...document.querySelectorAll<HTMLElement>(".rn-flap-bottom")].find((card) => card.getAnimations().length)!;
      const cardAnimations = [...document.querySelectorAll(".rn-flap")].flatMap((card) => card.getAnimations({ subtree: true }));
      const setTime = (time: number) => {
        for (const animation of cardAnimations) animation.currentTime = time;
      };
      setTime(25);
      const turning = getComputedStyle(top).filter;
      const turningSmear = Number(getComputedStyle(top.querySelector(".rn-flap-smear") ?? top).opacity);
      setTime(100);
      const landed = getComputedStyle(bottom).filter;
      const landedSmear = Number(getComputedStyle(bottom.querySelector(".rn-flap-smear") ?? bottom).opacity);
      setTime(25);
      return { turning, landed, turningSmear, landedSmear, smears: document.querySelectorAll(".rn-flap-smear").length, deviation: document.querySelector("feGaussianBlur")?.getAttribute("stdDeviation") };
    });
    expect(result.turning).not.toContain("blur("); // No isotropic CSS blur.
    if (blurred) {
      expect(result.smears).toBe(2);
      const [x, y] = result.deviation!.split(" ").map(Number);
      expect(x).toBe(0);
      expect(y).toBeGreaterThan(0);
      expect(result.turningSmear).toBeGreaterThan(0);
      expect(result.turningSmear).toBeLessThan(1);
      expect(result.landedSmear).toBe(0);
    } else expect(result.smears).toBe(0);
    expect(Number(/brightness\(([\d.]+)\)/.exec(result.turning)?.[1])).toBeLessThan(1);
    if (blurred) {
      const disabled = await page.evaluate(() => {
        const top = [...document.querySelectorAll<HTMLElement>(".rn-flap-top")].find((card) => card.getAnimations().length)!;
        const animation = top.getAnimations()[0]!;
        const time = animation.currentTime;
        const transform = getComputedStyle(top).transform;
        window.testText.update({ motionBlur: false });
        return { smears: document.querySelectorAll(".rn-flap-smear").length, definitions: document.querySelectorAll(".rn-blur-defs").length, preserved: top.getAnimations()[0] === animation && animation.currentTime === time && getComputedStyle(top).transform === transform };
      });
      expect(disabled.smears).toBe(0);
      expect(disabled.definitions).toBe(0);
      expect(disabled.preserved).toBe(true);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".rn-flap")).toHaveCount(0);
    await expect(page.locator("#number > .rn-value")).toBeVisible();
    await expect(page.locator("#number > .rn-value")).toHaveText("B");
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
}

for (const registrationAvailable of [true, false]) {
test(`fixed half-card strips preserve every face without registration (API available=${registrationAvailable})`, async ({ page }) => {
  if (!registrationAvailable) await page.addInitScript(() => { Object.defineProperty(CSS, "registerProperty", { value: undefined }); });
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountText({ text: "AA", charset: "ABCDEFGHIJKLM", mode: "flap", duration: 700, stagger: "start" }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const result = await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    const animations: Animation[] = [];
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause(); animation.currentTime = 0;
      animations.push(animation);
      return animation;
    };
    window.testText.update({ text: "MM" });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const reel = document.querySelectorAll(".rn-reel")[1]!;
    const cards = [...reel.querySelectorAll<HTMLElement>(".rn-flap")];
    const cardAnimations = animations.filter((animation) => {
      const target = (animation.effect as KeyframeEffect).target;
      return target !== reel && reel.contains(target);
    });
    const bottom = reel.querySelectorAll(".rn-flap-bottom")[1]!;
    const delay = Number(bottom.getAnimations()[0]!.effect!.getComputedTiming().delay);
    const faces: string[] = [];
    const front = (half: string) => {
      const card = cards.filter((card) => card.classList.contains(`rn-flap-${half}`) && Math.abs(new DOMMatrix(getComputedStyle(card).transform).m22) > .001).at(-1)!;
      const strip = card.firstElementChild!;
      const row = Math.round(-new DOMMatrix(getComputedStyle(strip).transform).m42 / parseFloat(card.style.height));
      return strip.textContent!.split("\n")[row];
    };
    const waiting = [front("top"), front("bottom")];
    for (let time = 0; time <= 1200; time += 25) {
      for (const animation of cardAnimations) animation.currentTime = delay + time;
      if (time % 100 === 0) faces.push(`${front("top")}${front("bottom")}`);
    }
    return { cards: cards.length, elements: reel.querySelectorAll("*").length, effects: cardAnimations.length, waiting, delay, faces };
  });
  expect(result.cards).toBe(4);
  expect(result.elements).toBe(9); // One drum, four half-card planes, four text strips, independent of travel.
  expect(result.effects).toBe(3);
  expect(result.delay).toBeGreaterThan(0);
  expect(result.waiting).toEqual(["A", "A"]);
  expect(result.faces).toEqual([..."ABCDEFGHIJKLM"].map((face) => face.repeat(2)));
});
}

test("turning cards respect a visibility-hidden ancestor", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountText({ text: "A", charset: "AB", mode: "flap", duration: 700 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const visible = await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { const animation = animate.apply(this, args); animation.pause(); animation.currentTime = 25; return animation; };
    window.testText.update({ text: "B" });
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    document.getElementById("fixture")!.style.visibility = "hidden";
    return [...document.querySelectorAll(".rn-flap")].some((card) => getComputedStyle(card).visibility === "visible");
  });
  expect(visible).toBe(false);
});

test("flip timing overrides are opt-in and invalid updates are atomic", async ({ page }) => {
  await page.goto("/test.html");
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.mountText({ text: "A", charset: "AB", mode: "flap", duration: 700, flipDuration: 220 }));
  await expect(page.locator("#number")).toHaveAttribute("data-rn-ready", "");
  const errors = await page.evaluate(() => [0, -1, NaN, Infinity, 10001].map((flipDuration) => {
    try { window.testText.update({ text: "B", flipDuration }); return false; }
    catch (error) { return error instanceof RangeError; }
  }));
  expect(errors).toEqual(Array(5).fill(true));
  await expect(page.locator("#number > .rn-value")).toHaveText("A");
  await page.evaluate(async () => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { const animation = animate.apply(this, args); animation.pause(); animation.currentTime = 0; return animation; };
    window.testText.update({ text: "B" });
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
  });
  const durations = await page.locator(".rn-flap").evaluateAll((cards) => cards.flatMap((card) => card.getAnimations().map((animation) => Number(animation.effect!.getTiming().duration))));
  expect(durations).toEqual([220, 220]);
  await page.evaluate(() => window.testText.update({ animated: false }));
  await expect(page.locator("#number > .rn-value")).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});
