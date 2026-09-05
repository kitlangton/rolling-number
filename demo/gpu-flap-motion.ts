/** Board-only, forward mechanical drums. No DOM, clocks, or GPU resources here. */
export interface DrumMotion { from: number; to: number; start: number; cadence: number }

export function position(motion: DrumMotion, now: number): number {
  return motion.from + Math.max(0, Math.min(motion.to - motion.from, (now - motion.start) / motion.cadence));
}

export function retarget(motion: DrumMotion, target: number, length: number, now: number, delay: number): DrumMotion {
  const from = Math.round(position(motion, now)) % length;
  return { from, to: from + (target - from + length) % length, start: now + delay, cadence: motion.cadence };
}

export function sweepDelay(rank: number, count: number): number {
  return rank * Math.min(900 * .045, 900 * .3 / Math.max(1, count - 1));
}

export const endsAt = (motion: DrumMotion) => motion.start + (motion.to - motion.from) * motion.cadence;
