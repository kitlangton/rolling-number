import { expect, it } from "vitest";
import { blurEnvelope, spring } from "../src/motion";

it("keeps slow and stationary reels sharp and caps fast blur", () => {
  expect(blurEnvelope(spring(5, 5, 0, 500)).points.every((point) => point === 0)).toBe(true);
  expect(blurEnvelope(spring(0, 1, 0, 2000)).points.every((point) => point === 0)).toBe(true);
  const fast = blurEnvelope(spring(0, 9, 0, 500));
  expect(Math.max(...fast.points)).toBe(1);
  expect(fast.points.every((point) => point >= 0 && point <= 1)).toBe(true);
  expect(fast.points[0]).toBe(0);
  expect(fast.points.at(-1)).toBe(0);
  expect(fast.target).toBe(0);
});

it("preserves blur at interruption and treats both directions equally", () => {
  const forward = blurEnvelope(spring(0, 9, 0, 500), .7);
  const backward = blurEnvelope(spring(9, 0, 0, 500), .7);
  expect(forward.points[0]).toBe(.7);
  forward.points.forEach((point, index) => expect(point).toBeCloseTo(backward.points[index]!, 10));
  expect(blurEnvelope(spring(0, 9, 0, 0)).points.every((point) => point === 0)).toBe(true);
});
