import { describe, expect, it } from "vitest";
import { flapCadence, flapFrames, flapMotion } from "../src/flap";

describe("flap timelines", () => {
  it("keeps cadence mechanical and logical travel independent of glyph count", () => {
    expect(flapCadence(100)).toBe(45);
    expect(flapCadence(700)).toBe(100);
    expect(flapCadence(1000)).toBe(110);
    expect(flapMotion(9, -3, 100)).toEqual({ points: [9, -3], target: -3, duration: 1200 });
  });
  for (const steps of [1, 2, 12, 43]) {
    it(`aligns every index boundary and hinge reset for ${steps} steps`, () => {
      const { index, falls, lands } = flapFrames(steps);
      expect(index).toHaveLength(steps + 1);
      expect(falls).toHaveLength(steps * 3);
      expect(lands).toHaveLength(steps * 3);
      for (let step = 0; step < steps; step++) {
        expect(index[step]!["--rn-flap-step"]).toBe(String(step));
        expect(index[step]!.offset).toBe(falls[step * 3]!.offset);
        expect(index[step]!.offset).toBe(lands[step * 3]!.offset);
        expect(index[step + 1]!.offset).toBe(falls[step * 3 + 2]!.offset);
        expect(index[step + 1]!.offset).toBe(lands[step * 3 + 2]!.offset);
        expect(index[step]!.easing).toBe("steps(1, end)");
        expect(falls[step * 3]!.transform).toBe("perspective(5em) rotateX(0deg)");
        expect(lands[step * 3 + 2]!.transform).toBe("perspective(5em) rotateX(0deg)");
        expect(lands[step * 3 + 2]!.filter).toBe("brightness(1)");
      }
    });
  }
});
