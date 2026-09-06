import { StrictMode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRollingNumber, createRollingText, type RollingNumberController, type RollingNumberOptions, type RollingTextController, type RollingTextOptions } from "../src/index";
import { RollingNumber, RollingText } from "../src/react";
import { Track } from "../src/track";
import { sample, spring, type Motion } from "../src/motion";
import "../src/styles.css";

declare global {
  interface Window {
    testNumber: RollingNumberController;
    testText: RollingTextController;
    mountNumber(options: RollingNumberOptions): void;
    mountText(options: RollingTextOptions): void;
    reactNumber(options: RollingNumberOptions, hydrate?: boolean): void;
    unmountReact(): void;
    mountRefProbe(kind?: "number" | "text", mode?: "callback" | "object", updated?: boolean): void;
    refProbe: { mounted: number; cleaned: number; nullCalls: number };
    refObject: { current: HTMLSpanElement | null };
    opacityProbe(): { expected: number; actual: number };
    opacityPlaybackProbe(motion: Motion, invert: boolean): { maxError: number; keyframes: number; remaining: number };
    ready: boolean;
  }
}
const fixture = document.getElementById("fixture")!;
let react: Root | undefined;
function mount() {
  window.testNumber?.destroy();
  window.testText?.destroy();
  fixture.replaceChildren();
  const span = document.createElement("span");
  span.id = "number";
  span.style.cssText = "font: 64px/1.2 Georgia,serif; font-variant-numeric:tabular-nums";
  fixture.append(span);
  return span;
}
window.mountNumber = (options) => { window.testNumber = createRollingNumber(mount(), { pauseOffscreen: false, ...options }); };
window.mountText = (options) => { window.testText = createRollingText(mount(), { pauseOffscreen: false, ...options }); };
window.reactNumber = (options, hydrate = false) => {
  const element = <StrictMode><RollingNumber {...options} id="react-number" style={{ fontSize: 64 }} /></StrictMode>;
  if (!react) {
    if (hydrate) {
      fixture.innerHTML = renderToString(element);
      react = hydrateRoot(fixture, element);
    } else react = createRoot(fixture);
  }
  if (!hydrate) react.render(element);
};
window.unmountReact = () => { react?.unmount(); react = undefined; };
window.refProbe = { mounted: 0, cleaned: 0, nullCalls: 0 };
window.refObject = { current: null };
window.mountRefProbe = (kind = "number", mode = "callback", updated = false) => {
  react ??= createRoot(fixture);
  const ref = mode === "object" ? window.refObject : (node: HTMLSpanElement | null) => {
    if (!node) { window.refProbe.nullCalls++; return; }
    window.refProbe.mounted++;
    return () => { window.refProbe.cleaned++; };
  };
  react.render(<StrictMode>{kind === "text" ? <RollingText text={updated ? "B" : "A"} duration={1000} ref={ref} /> : <RollingNumber value={updated ? 8 : 1} duration={1000} ref={ref} />}</StrictMode>);
};
window.opacityProbe = () => {
  const element = document.createElement("span");
  fixture.append(element);
  const motion = spring(1.03, 1, -4.5, 1000);
  const track = new Track(element, "opacity");
  track.play(motion, (value) => String(Math.max(0, Math.min(1, value))));
  for (const animation of element.getAnimations()) { animation.pause(); animation.currentTime = 100; }
  const result = { expected: sample(motion, 100).position, actual: Number(getComputedStyle(element).opacity) };
  track.cancel();
  element.remove();
  return result;
};
window.opacityPlaybackProbe = (motion, invert) => {
  const element = document.createElement("span");
  const reference = document.createElement("span");
  fixture.append(element, reference);
  const format = (value: number) => String(Math.max(0, Math.min(1, invert ? 1 - value : value)));
  const track = new Track(element, "opacity");
  track.play(motion, format);
  const animation = element.getAnimations()[0]!;
  const explicit = reference.animate(motion.points.map((point) => ({ opacity: format(point) })), { duration: motion.duration, fill: "both" });
  animation.pause();
  explicit.pause();
  let maxError = 0;
  // Include sample boundaries, interpolated midpoints, and the native endpoint.
  for (let index = 0; index <= 96; index++) {
    animation.currentTime = explicit.currentTime = motion.duration * index / 96;
    maxError = Math.max(maxError, Math.abs(Number(getComputedStyle(element).opacity) - Number(getComputedStyle(reference).opacity)));
  }
  const keyframes = (animation.effect as KeyframeEffect).getKeyframes().length;
  track.cancel();
  explicit.cancel();
  const remaining = element.getAnimations().length + reference.getAnimations().length;
  element.remove();
  reference.remove();
  return { maxError, keyframes, remaining };
};
window.ready = true;
