import { expect, it, vi } from "vitest";
import { sample, spring } from "../src/motion";
import { animateNow, Track } from "../src/track";

function fixture() {
  const animations: { currentTime: number; onfinish: (() => void) | null; cancel: ReturnType<typeof vi.fn> }[] = [];
  const animate = vi.fn(() => {
    const animation = { currentTime: 0, onfinish: null as (() => void) | null, cancel: vi.fn() };
    animations.push(animation);
    return animation;
  });
  const setProperty = vi.fn();
  // Only these native methods are used by Track; no DOM or layout is simulated.
  const element = { ownerDocument: { defaultView: null }, style: { setProperty }, animate } as unknown as HTMLElement;
  return { track: new Track(element, "transform"), animate, animations, setProperty };
}

const translate = (value: number) => `translateX(${value}px)`;

it.each(["running", "paused"])("anchors running effects without overriding an explicitly %s animation", (playState) => {
  const animation = { playState, startTime: null as number | null };
  const element = { ownerDocument: { timeline: { currentTime: 123 } }, animate: () => animation } as unknown as HTMLElement;
  animateNow(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 });
  expect(animation.startTime).toBe(playState === "running" ? 123 : null);
});

it.each([spring(2, 2, 0, 500), spring(2, 8, 0, 0)])("does not retain a trajectory without native playback ($duration ms)", (motion) => {
  const { track, animate, setProperty } = fixture();
  const done = vi.fn();
  track.play(motion, translate, done);
  expect(animate).not.toHaveBeenCalled();
  expect(done).toHaveBeenCalledOnce();
  expect(setProperty).toHaveBeenLastCalledWith("transform", translate(motion.target));
  expect(track.read()).toEqual({ position: motion.target, velocity: 0 });
  expect(Reflect.get(track, "motion")).toBeUndefined();
});

it("samples active playback and releases it on cancellation", () => {
  const { track, animations } = fixture();
  const motion = spring(2, 8, 0, 500);
  track.play(motion, translate);
  const animation = animations[0]!;
  animation.currentTime = 125;
  expect(track.read()).toEqual(sample(motion, 125));
  track.cancel();
  expect(animation.onfinish).toBeNull();
  expect(animation.cancel).toHaveBeenCalledOnce();
  expect(Reflect.get(track, "motion")).toBeUndefined();
  expect(track.read()).toEqual({ position: 8, velocity: 0 });
});

it.each([0, 500])("completion can start another motion (%i ms)", (duration) => {
  const { track, animations } = fixture();
  const next = spring(8, 3, 0, 500);
  track.play(spring(2, 8, 0, duration), translate, () => track.play(next, translate));
  if (duration) animations[0]!.onfinish!();
  const active = animations.at(-1)!;
  active.currentTime = 125;
  expect(track.read()).toEqual(sample(next, 125));
  expect(Reflect.get(track, "motion")).toBe(next);
});

it("propagates native setup errors without retaining a trajectory", () => {
  const { track, animate } = fixture();
  const error = new Error("Native animation setup failed");
  animate.mockImplementation(() => { throw error; });
  expect(() => track.play(spring(2, 8, 0, 500), translate)).toThrow(error);
  expect(Reflect.get(track, "motion")).toBeUndefined();
  expect(track.read()).toEqual({ position: 8, velocity: 0 });
});
