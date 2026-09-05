import { expect, it } from "vitest";
import { collapsePositions, entryRanks } from "../src/layout";
import { delayed, entrance, sample } from "../src/motion";

it("staggers new tokens outward from the retained digits, separators included", () => {
  // 23 -> 5,823,823: "5" "," "8" "2" "3" "," [8] [2] [3] where [] are retained places.
  expect(entryRanks([false, false, false, false, false, false, false, true, true])).toEqual([7, 6, 5, 4, 3, 2, 1, 0, 0]);
  // 1.5 -> 21.75: new digits on both sides cascade away from the kept "1" "." "5".
  expect(entryRanks([false, true, true, true, false])).toEqual([1, 0, 0, 0, 1]);
  expect(entryRanks([false, false, false])).toEqual([1, 2, 3]);
});

it("holds a delayed motion at its first point and then follows the original exactly", () => {
  const motion = entrance(40, 500);
  const held = delayed(motion, 100);
  expect(held.duration).toBe(600);
  expect(sample(held, 0).position).toBe(40);
  expect(sample(held, 99).position).toBe(40);
  expect(sample(held, 350).position).toBeCloseTo(sample(motion, 250).position, 1);
  expect(sample(held, 600)).toEqual({ position: 0, velocity: 0 });
  expect(delayed(motion, 0)).toBe(motion);
});

it("opens and closes gaps at retained token edges", () => {
  const positions = new Map([["prefix", { x: 0, width: 8 }], ["units", { x: 8, width: 10 }]]);
  const keys = ["prefix", "hundreds", "tens", "units", "suffix"];
  expect([...collapsePositions(keys, positions)]).toEqual([
    ["hundreds", 8], ["tens", 8], ["suffix", 18],
  ]);
  expect([...collapsePositions(["prefix", "units"], positions)]).toEqual([]);
  expect([...collapsePositions(["a", "b"], new Map())]).toEqual([["a", 0], ["b", 0]]);
  expect([...collapsePositions([], positions)]).toEqual([]);
});

it("reveals new glyphs from below only after horizontal space starts opening", () => {
  const motion = entrance(40, 500);
  expect(sample(motion, 0)).toEqual({ position: 40, velocity: 0 });
  expect(sample(motion, 50).position).toBe(40);
  expect(sample(motion, 250).position).toBeLessThan(5);
  expect(Math.abs(sample(motion, 350).velocity)).toBeLessThan(Math.abs(sample(motion, 200).velocity));
  expect(sample(motion, 500)).toEqual({ position: 0, velocity: 0 });
  expect(motion.points.every((point, index) => index === 0 || point <= motion.points[index - 1]!)).toBe(true);
});

it("supports board-style cascades from either edge and no stagger at all", () => {
  const retained = [true, false, false, true, false];
  expect(entryRanks(retained, "start")).toEqual([0, 1, 2, 0, 3]);
  expect(entryRanks(retained, "end")).toEqual([0, 3, 2, 0, 1]);
  expect(entryRanks(retained, "none")).toEqual([0, 1, 1, 0, 1]);
  expect(entryRanks(retained, "outward")).toEqual([0, 1, 1, 0, 1]);
});
