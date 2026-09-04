import { expect, it } from "vitest";
import { numeral, rollTarget, sample, spring } from "../src/motion";

it("starts from the sampled interruption position and settles exactly", () => {
  const first = spring(0, 9, 0, 500);
  const current = sample(first, 150);
  const second = spring(current.position, 2, current.velocity, 500);
  expect(sample(second, 0).position).toBe(current.position);
  expect(sample(second, 500)).toEqual({ position: 2, velocity: 0 });
  expect(sample(second, 1000)).toEqual({ position: 2, velocity: 0 });
});

it("keeps wrap travel bounded and direction explicit", () => {
  expect(rollTarget(9, 0, 1)).toBe(10);
  expect(rollTarget(0, 9, -1)).toBe(-1);
  expect(rollTarget(9.5, 1, 1)).toBe(11);
  expect(rollTarget(9.5, 1, -1)).toBe(1);
  expect(numeral(-1)).toBe("9");
  for (let digit = 0; digit < 10; digit++) {
    const motion = spring(5.5, rollTarget(5.5, digit, 1), 1e9, 500);
    expect(Math.max(...motion.points) - Math.min(...motion.points)).toBeLessThan(13);
  }
});

it("rolls arbitrary wheels forward and wraps faces in both directions", async () => {
  const { face } = await import("../src/motion");
  const wheel = [" ", "A", "B", "C"];
  expect(face(wheel, 5)).toBe("A");
  expect(face(wheel, -1)).toBe("C");
  // Forward-only trend from "C" (index 3) to "A" (index 1) travels through the blank, not backwards.
  expect(rollTarget(3, 1, 1, wheel.length)).toBe(5);
  expect(rollTarget(3, 1, -1, wheel.length)).toBe(1);
});
