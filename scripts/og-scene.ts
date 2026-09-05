import { createRollingNumber, createRollingText } from "../src/index";

// A deterministic frame of the real renderer, not a hand-drawn imitation.
const title = createRollingText(document.getElementById("title")!, {
  text: "rolling numb  ", charset: [..."rolling number"].map((glyph) => ` ${glyph}`), duration: 400,
  stagger: "start", motionBlur: true, pauseOffscreen: false,
});
const number = createRollingNumber(document.getElementById("number")!, {
  value: 9708, locales: "en-US", duration: 450, motionBlur: true,
  format: { maximumFractionDigits: 0 }, pauseOffscreen: false,
});
await document.fonts.ready;
await new Promise(requestAnimationFrame);
await new Promise(requestAnimationFrame);
// Only the last few title letters are still moving; the brand remains readable.
title.update({ text: "rolling number" });
number.update({ value: 9973 });
await new Promise(requestAnimationFrame);
await new Promise(requestAnimationFrame);
for (const animation of document.getAnimations()) {
  animation.pause();
  const target = (animation.effect as KeyframeEffect).target;
  animation.currentTime = target instanceof Element && target.closest("#title") ? 160 : Number(document.documentElement.dataset.ogFrame ?? 12);
}
document.documentElement.dataset.ogReady = "";
