import { spring } from "../src/motion";

/** The digit spring as a native easing for other demo effects. */
export function springEasing(duration: number): string {
  return `linear(${spring(0, 1, 0, duration).points.map((point) => point.toFixed(5)).join(",")})`;
}
