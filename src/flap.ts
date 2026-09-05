import { face, type Motion } from "./motion.js";
import { animateNow } from "./track.js";

/**
 * Four temporary half-card strips model one hinge: the current top falls, then
 * the next bottom lands. Native stepped timing advances their glyphs together.
 * Travel is bounded by the wheel size; all strips disappear on settlement.
 */

/** Milliseconds per card. Derived from the requested duration, kept in a mechanical range. */
export function flapCadence(duration: number): number {
  return Math.max(45, Math.min(110, duration / 7));
}

/** Logical wheel position advancing one face per card, for interruption sampling. */
export function flapMotion(from: number, to: number, cadence: number): Motion {
  const steps = Math.abs(to - from);
  return { points: [from, to], target: to, duration: steps * cadence };
}

/** Pure timeline for a positive number of steps. Every boundary uses identical offsets. */
export function flapFrames(steps: number) {
  const lit = "brightness(1)";
  const shaded = "brightness(.45)";
  const index = Array.from({ length: steps + 1 }, (_, step) => ({ "--rn-flap-step": String(step), offset: step / steps, easing: "steps(1, end)" }));
  const falls: Keyframe[] = [];
  const lands: Keyframe[] = [];
  for (let step = 0; step < steps; step++) {
    const start = step / steps;
    const middle = (step + .5) / steps;
    const end = (step + 1) / steps;
    falls.push(
      { transform: "perspective(5em) rotateX(0deg)", filter: lit, offset: start, easing: "cubic-bezier(.6, 0, 1, .5)" },
      { transform: "perspective(5em) rotateX(-90deg)", filter: shaded, offset: middle },
      { transform: "perspective(5em) rotateX(-90deg)", filter: shaded, offset: end },
    );
    lands.push(
      { transform: "perspective(5em) rotateX(90deg)", filter: shaded, offset: start },
      { transform: "perspective(5em) rotateX(90deg)", filter: shaded, offset: middle, easing: "linear(0, 0.58, 0.9, 1, 1.045 78%, 1)" },
      { transform: "perspective(5em) rotateX(0deg)", filter: lit, offset: end },
    );
  }
  return { index, falls, lands };
}

/** Disable softness without interrupting a half-card's transform or timing. */
export function clearFlapBlur(root: HTMLElement): void {
  for (const smear of root.querySelectorAll(".rn-flap-smear")) {
    for (const animation of smear.getAnimations()) animation.cancel();
    smear.remove();
  }
  for (const sharp of root.querySelectorAll(".rn-flap-sharp")) {
    for (const animation of sharp.getAnimations()) animation.cancel();
    sharp.classList.remove("rn-flap-sharp");
  }
}

export function buildFlaps(reel: HTMLElement, wheel: readonly string[], from: number, to: number, height: number, cadence: number, delay: number, blur?: string): void {
  const doc = reel.ownerDocument;
  const steps = Math.abs(to - from);
  const direction = to >= from ? 1 : -1;
  if (!steps) { reel.replaceChildren(); return; }
  const frames = flapFrames(steps);
  const faces = Array.from({ length: steps + 1 }, (_, step) => face(wheel, from + step * direction));
  const nextFaces = [...faces.slice(1), faces.at(-1)!];
  const multilineGlyph = faces.some((glyph) => /[\r\n\f\u2028\u2029]/u.test(glyph));
  const drum = doc.createElement("span");
  drum.style.cssText = `display:block;position:relative;height:${height}px`;
  // Explicit step-end holds also work for an unregistered, discrete custom
  // property. No global registration or alternate transform-strip path is needed.
  animateNow(drum, frames.index, { delay, duration: steps * cadence, fill: "both" });
  const plane = (half: "top" | "bottom", next: boolean) => {
    const card = doc.createElement("span");
    card.className = `rn-face rn-flap rn-flap-${half}`;
    card.style.height = `${height}px`;
    card.style.overflow = "hidden";
    const strip = doc.createElement("span");
    strip.style.cssText = `display:block;white-space:pre;line-height:${height}px`;
    const rows = next ? nextFaces : faces;
    if (multilineGlyph) {
      // A caller-supplied line-break glyph must not become an extra strip row.
      for (const glyph of rows) {
        const row = doc.createElement("span");
        row.style.cssText = `display:block;height:${height}px`;
        row.textContent = glyph;
        strip.append(row);
      }
    } else strip.textContent = rows.join("\n");
    card.append(strip);
    strip.style.transform = `translateY(calc(var(--rn-flap-step) * ${-height}px))`;
    return card;
  };
  const bottom = plane("bottom", false);
  const top = plane("top", true);
  const falling = plane("top", false);
  const landing = plane("bottom", true);
  if (blur) {
    const soften = (card: HTMLElement, motion: Keyframe[]) => {
      const sharp = card.firstElementChild as HTMLElement;
      const copy = sharp.cloneNode(true);
      sharp.classList.add("rn-flap-sharp");
      const smear = doc.createElement("span");
      smear.className = "rn-flap-smear";
      // Clip the source before filtering: blur one glyph, not the entire long strip.
      smear.style.cssText = "display:block;position:absolute;inset:0;overflow:hidden";
      smear.style.filter = blur;
      smear.append(copy);
      card.append(smear);
      const opacity = motion.map((frame) => ({ offset: frame.offset!, easing: frame.easing ?? "linear", opacity: frame.filter === "brightness(1)" ? 0 : 1 }));
      const timing = { delay, duration: steps * cadence, fill: "both" as const };
      animateNow(smear, opacity, timing);
      animateNow(sharp, opacity.map((frame) => ({ ...frame, opacity: 1 - frame.opacity })), timing);
    };
    soften(falling, frames.falls);
    soften(landing, frames.lands);
  }
  // Edge-on resting transforms replace visibility animations, so playback only
  // changes the stepped index, transforms and filters. Each plane projects locally, not via a shared
  // parent perspective that would make the whole drum a changing 3D scene.
  falling.style.transform = "perspective(5em) rotateX(-90deg)";
  // Use the same total-duration timeline as the stepped index. Repeated hinge
  // iterations can round to the previous cycle at an index boundary in Chromium.
  animateNow(falling, frames.falls, { delay, duration: steps * cadence, fill: "backwards" });
  landing.style.transform = "perspective(5em) rotateX(90deg)";
  animateNow(landing, frames.lands, { delay, duration: steps * cadence, fill: "forwards" });
  reel.style.height = `${height}px`;
  drum.append(bottom, top, landing, falling);
  reel.replaceChildren(drum);
}
