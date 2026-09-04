import { sample, type Motion, type Sample } from "./motion.js";

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
    const animation = this.element.animate(
      motion.points.map((point) => ({ [this.property]: format(point) })),
      { duration: motion.duration, easing: "linear" },
    );
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
