import { sample, type Motion, type Sample } from "./motion.js";

const linearSupport = new WeakMap<Window, boolean>();

/** Start every effect in a transition on the same document frame, without a pending play task. */
export function animateNow(element: HTMLElement, keyframes: Keyframe[], timing: KeyframeAnimationOptions): Animation {
  const animation = element.animate(keyframes, timing);
  // Native play() otherwise waits for a later paint to assign its start time.
  // Pointer input can replace it first, repeatedly sampling position/velocity at
  // time zero. Anchor to this document's frame, not a separate JS clock.
  const now = element.ownerDocument.timeline?.currentTime;
  if (typeof now === "number" && animation.playState === "running") animation.startTime = now;
  return animation;
}
function supportsLinear(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  let supported = linearSupport.get(view);
  if (supported === undefined) {
    supported = view.CSS?.supports("animation-timing-function", "linear(0, 1)") ?? false;
    linearSupport.set(view, supported);
  }
  return supported;
}

/** One animation owner per property. No accumulated effects or finished promises. */
export class Track {
  private animation: Animation | undefined;
  private motion: Motion | undefined;
  private value = 0;

  constructor(private element: HTMLElement, private property: "transform" | "opacity") {}

  read(): Sample {
    const time = this.animation?.currentTime;
    return this.animation && this.motion
      ? sample(this.motion, typeof time === "number" ? time : 0)
      : { position: this.value, velocity: 0 };
  }

  set(value: number, format: (value: number) => string): void {
    this.cancel();
    this.value = value;
    this.element.style.setProperty(this.property, format(value));
  }

  play(motion: Motion, format: (value: number) => string, done?: () => void): void {
    this.cancel();
    this.value = motion.target;
    this.element.style.setProperty(this.property, format(motion.target));
    if (!motion.duration || motion.points.every((point) => point === motion.target)) {
      done?.();
      return;
    }
    const first = motion.points[0] ?? motion.target;
    const distance = motion.target - first;
    // Two parsed transforms + a sampled easing are much cheaper than dozens of
    // fully parsed transform keyframes. Zero-distance spring motion still needs
    // explicit frames; older browsers keep the same trajectory via that fallback.
    // Opacity uses its formatted samples as easing outputs between 0 and 1.
    // Clamp before interpolation, preserving overshoot and equal-endpoint pulses.
    const compactOpacity = this.property === "opacity" && supportsLinear(this.element);
    const compact = this.property === "transform" && Math.abs(distance) > 0.00001 && supportsLinear(this.element);
    const keyframes = compactOpacity ? [{ opacity: 0 }, { opacity: 1 }] : compact
      ? [{ [this.property]: format(first) }, { [this.property]: format(motion.target) }]
      : motion.points.map((point) => ({ [this.property]: format(point) }));
    const easing = compactOpacity ? `linear(${motion.points.map(format).join(",")})` : compact
      ? `linear(${motion.points.map((point) => Number(((point - first) / distance).toFixed(6))).join(",")})`
      : "linear";
    const animation = animateNow(this.element, keyframes, { duration: motion.duration, easing });
    this.animation = animation;
    this.motion = motion;
    animation.onfinish = () => {
      if (this.animation !== animation) return;
      this.animation = undefined;
      this.motion = undefined;
      animation.onfinish = null;
      animation.cancel();
      done?.();
    };
  }

  cancel(): void {
    if (this.animation) {
      this.animation.onfinish = null;
      this.animation.cancel();
      this.animation = undefined;
    }
    this.motion = undefined;
  }
}
