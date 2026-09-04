import { sample, type Motion, type Sample } from "./motion.js";

const linearSupport = new WeakMap<Window, boolean>();
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
    this.motion = motion;
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
    // Opacity formatting clamps overshoot, so it is not an affine mapping.
    const compact = this.property === "transform" && Math.abs(distance) > 0.00001 && supportsLinear(this.element);
    const keyframes = compact
      ? [{ [this.property]: format(first) }, { [this.property]: format(motion.target) }]
      : motion.points.map((point) => ({ [this.property]: format(point) }));
    const easing = compact
      ? `linear(${motion.points.map((point) => Number(((point - first) / distance).toFixed(6))).join(",")})`
      : "linear";
    const animation = this.element.animate(keyframes, { duration: motion.duration, easing });
    this.animation = animation;
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
