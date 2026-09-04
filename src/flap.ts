import type { Motion } from "./motion.js";

/**
 * Split-flap mechanics. Each step hinges one card at the slot's midline: the top
 * half of the current face falls forward, then the bottom half of the next face
 * lands. Cards are bounded by the wheel size and removed when the sequence settles.
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

const fall = "cubic-bezier(.6, 0, 1, .5)";
const land = "linear(1, 0.42, 0.1, 0, -0.045 78%, 0)";

export function buildFlaps(reel: HTMLElement, wheel: readonly string[], from: number, to: number, height: number, cadence: number, delay: number): void {
  const doc = reel.ownerDocument;
  const face = (position: number): string => wheel[((position % wheel.length) + wheel.length) % wheel.length]!;
  const card = (text: string, half: "top" | "bottom"): HTMLSpanElement => {
    const element = doc.createElement("span");
    element.className = `rn-face rn-flap rn-flap-${half}`;
    element.textContent = text;
    element.style.height = `${height}px`;
    return element;
  };
  reel.style.height = `${height}px`;
  const direction = to >= from ? 1 : -1;
  const steps = Math.abs(to - from);
  // Paint order is z-order: landed bottoms stack upward, waiting tops stack downward.
  const statics = [card(face(from), "bottom"), card(face(to), "top")];
  const bottoms: HTMLSpanElement[] = [];
  const tops: HTMLSpanElement[] = [];
  const half = cadence / 2;
  for (let step = 0; step < steps; step++) {
    const position = from + step * direction;
    const start = delay + step * cadence;
    // Light falls off as a card turns away from the viewer, which is what sells the depth.
    const top = card(face(position), "top");
    top.animate([{ transform: "rotateX(0deg)", filter: "brightness(1)" }, { transform: "rotateX(-90deg)", filter: "brightness(.45)" }], { delay: start, duration: half, easing: fall, fill: "both" });
    const bottom = card(face(position + direction), "bottom");
    bottom.animate([{ transform: "rotateX(90deg)", filter: "brightness(.45)" }, { transform: "rotateX(0deg)", filter: "brightness(1)" }], { delay: start + half, duration: half, easing: land, fill: "both" });
    tops.unshift(top);
    bottoms.push(bottom);
  }
  reel.replaceChildren(...statics, ...bottoms, ...tops);
}
