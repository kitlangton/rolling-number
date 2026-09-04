import { expect, it } from "vitest";
import { collapsePositions } from "../src/layout";
import { entrance, sample } from "../src/motion";

it("opens and closes gaps at retained token edges", () => {
  const positions = new Map([["prefix", { x: 0, width: 8 }], ["units", { x: 8, width: 10 }]]);
  const keys = ["prefix", "hundreds", "tens", "units", "suffix"];
  expect([...collapsePositions(keys, positions)]).toEqual([
    ["prefix", 0], ["hundreds", 8], ["tens", 8], ["units", 8], ["suffix", 18],
  ]);
});

it("reveals new glyphs from below only after horizontal space starts opening", () => {
  const motion = entrance(40, 500);
  expect(sample(motion, 0)).toEqual({ position: 40, velocity: 0 });
  expect(sample(motion, 50).position).toBe(40);
  expect(sample(motion, 250).position).toBeCloseTo(20, 5);
  expect(sample(motion, 500)).toEqual({ position: 0, velocity: 0 });
  expect(motion.points.every((point, index) => index === 0 || point <= motion.points[index - 1]!)).toBe(true);
});
