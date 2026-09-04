export interface Motion {
  readonly points: readonly number[];
  readonly duration: number;
  readonly target: number;
}

export interface Sample {
  position: number;
  velocity: number;
}

/** Let horizontal space open before a new glyph rises through its fixed viewport. */
export function entrance(height: number, duration: number): Motion {
  return {
    target: 0, duration,
    points: Array.from({ length: 49 }, (_, index) => {
      const progress = Math.max(0, Math.min(1, (index / 48 - .12) / .76));
      return height * (1 - progress * progress * (3 - 2 * progress));
    }),
  };
}

/** Critically damped spring, sampled once for native WAAPI playback. */
export function spring(from: number, target: number, velocity: number, duration: number): Motion {
  if (duration <= 0) return { points: [target, target], duration: 0, target };
  const seconds = duration / 1000;
  const distance = from - target;
  // Bound inherited energy after huge updates; a wheel never needs hundreds of faces.
  const limit = Math.max(Math.abs(distance), 1) * 12 / seconds;
  const inherited = Math.max(-limit, Math.min(limit, velocity)) * seconds;
  const points = Array.from({ length: 49 }, (_, index) => {
    if (index === 48) return target;
    const time = index / 48;
    return target + (distance + (inherited + 10 * distance) * time) * Math.exp(-10 * time);
  });
  return { points, duration, target };
}

/** Matches linear interpolation between the exact keyframes sent to the browser. */
export function sample(motion: Motion, time: number): Sample {
  if (time >= motion.duration || motion.duration === 0) return { position: motion.target, velocity: 0 };
  const progress = Math.max(0, time) / motion.duration * (motion.points.length - 1);
  const index = Math.min(Math.floor(progress), motion.points.length - 2);
  const left = motion.points[index] ?? motion.target;
  const right = motion.points[index + 1] ?? motion.target;
  return {
    position: left + (right - left) * (progress - index),
    velocity: (right - left) * (motion.points.length - 1) * 1000 / motion.duration,
  };
}

export function rollTarget(position: number, digit: number, trend: -1 | 0 | 1): number {
  let target = Math.floor(position / 10) * 10 + digit;
  if (trend > 0 && target < position - 0.001) target += 10;
  else if (trend < 0 && target > position + 0.001) target -= 10;
  else if (trend === 0) target += Math.round((position - target) / 10) * 10;
  return target;
}

export const numeral = (position: number): string => String(((position % 10) + 10) % 10);
