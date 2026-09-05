import { describe, expect, it } from "vitest";
import { impactGain, impacts, synthesizeImpact } from "../demo/board-sound";

describe("board impact timing", () => {
  it("follows the half-card cadence without double counting", () => {
    expect(impacts(55, 110, 3, 0, 54)).toBe(0);
    expect(impacts(55, 110, 3, 54, 55)).toBe(1);
    expect(impacts(55, 110, 3, 55, 60)).toBe(0);
    expect(impacts(55, 110, 3, 160, 180)).toBe(1);
    expect(impacts(55, 110, 3, 300, 1000)).toBe(0);
  });
  it("drops missed impacts instead of replaying a backlog", () => {
    expect(impacts(55, 110, 20, 0, 500)).toBe(1);
    expect(impacts(55, 110, 20, 500, 490)).toBe(0);
    expect(impacts(55, 110, 20, 0, 2500)).toBe(0);
  });
  it("grows sublinearly and caps a whole board's volume", () => {
    expect(impactGain(0)).toBe(0);
    expect(impactGain(4)).toBe(impactGain(1) * 2);
    expect(impactGain(1000)).toBe(.12);
  });
});

it("synthesizes distinct short, bounded impacts at native sample rates", () => {
  for (const rate of [44100, 48000]) {
    const tick = synthesizeImpact(rate, "tick", () => .7);
    const clack = synthesizeImpact(rate, "clack", () => .7);
    expect(tick.length).toBe(Math.ceil(rate * .055));
    expect(tick[0]).toBe(0);
    expect(Math.abs(tick.at(-1)!)).toBeLessThan(.0001);
    expect(Math.max(...tick.map(Math.abs))).toBeLessThan(1);
    expect(Math.max(...tick.map(Math.abs))).toBeGreaterThan(.1);
    expect(tick).not.toEqual(clack);
  }
});
