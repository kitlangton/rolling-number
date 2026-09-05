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
      if (index === 48) return 0;
      const progress = Math.max(0, Math.min(1, (index / 48 - .14) / .86));
      return height * (1 + 10 * progress) * Math.exp(-10 * progress);
    }),
  };
}

/** Hold the first point for `delay`, then play the motion unchanged; sampling stays exact. */
export function delayed(motion: Motion, delay: number): Motion {
  if (delay <= 0 || motion.duration <= 0) return motion;
  const duration = motion.duration + delay;
  const count = Math.round((motion.points.length - 1) * duration / motion.duration) + 1;
  const first = motion.points[0] ?? motion.target;
  return {
    target: motion.target, duration,
    points: Array.from({ length: count }, (_, index) => {
      if (index === count - 1) return motion.target;
      const time = index / (count - 1) * duration - delay;
      return time <= 0 ? first : sample(motion, time).position;
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

/** Blend into a vertical smear as reel speed rises from 4 to 24 rows/second. */
export function blurEnvelope(motion: Motion, from = 0, fullSpeed = 24): Motion {
  if (motion.duration <= 0) return { points: [0, 0], duration: 0, target: 0 };
  const step = motion.duration / (motion.points.length - 1) / 1000;
  return {
    duration: motion.duration, target: 0,
    points: motion.points.map((_, index, points) => {
      if (index === 0) return Math.max(0, Math.min(1, from));
      if (index === points.length - 1) return 0;
      const speed = Math.abs((points[index + 1]! - points[index - 1]!) / (2 * step));
      const onset = fullSpeed / 6;
      return Math.max(0, Math.min(1, (speed - onset) / (fullSpeed - onset)));
    }),
  };
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

/** Nearest wheel position showing `index`, honoring the trend; `size` faces per revolution. */
export function rollTarget(position: number, index: number, trend: -1 | 0 | 1, size = 10): number {
  let target = Math.floor(position / size) * size + index;
  if (trend > 0 && target < position - 0.001) target += size;
  else if (trend < 0 && target > position + 0.001) target -= size;
  else if (trend === 0) target += Math.round((position - target) / size) * size;
  return target;
}

/** The face shown at an integer wheel position, wrapping in both directions. */
export const face = (wheel: readonly string[], position: number): string => wheel[((position % wheel.length) + wheel.length) % wheel.length]!;
export const numeral = (position: number): string => String(((position % 10) + 10) % 10);

/** Keep only the visible pair plus the newest glyph; interrupted words never build a queue. */
export function directRoll(previous: readonly string[], position: number, glyph: string) {
  const floor = Math.floor(position);
  const from = position - floor;
  const wheel = [face(previous, floor)];
  if (from > .00001) wheel.push(face(previous, floor + 1));
  if (wheel.at(-1) !== glyph) wheel.push(glyph);
  return { wheel, from, target: wheel.length - 1 };
}
