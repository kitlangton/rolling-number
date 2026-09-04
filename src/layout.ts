export interface Position { x: number; width: number }

/**
 * Stagger order for new tokens: 0 for retained tokens, then 1, 2, ... spreading
 * outward from the nearest retained token so a growing number cascades from the
 * digits already on screen. Without any retained token the order is left to right.
 */
export function entryRanks(retained: readonly boolean[]): number[] {
  const ranks = retained.map((kept, index) => kept ? 0 : index + 1);
  if (!retained.includes(true)) return ranks;
  let last = -Infinity;
  for (let index = 0; index < retained.length; index++) {
    if (retained[index]) last = index;
    else ranks[index] = index - last;
  }
  last = Infinity;
  for (let index = retained.length - 1; index >= 0; index--) {
    if (retained[index]) last = index;
    else ranks[index] = Math.min(ranks[index]!, last - index);
  }
  return ranks;
}

/** Missing columns share the next retained edge; trailing columns share the last end. */
export function collapsePositions(keys: readonly string[], positions: ReadonlyMap<string, Position>): Map<string, number> {
  const result = new Map<string, number>();
  const pending: string[] = [];
  let end = 0;
  for (const key of keys) {
    const position = positions.get(key);
    if (!position) { pending.push(key); continue; }
    for (const missing of pending) result.set(missing, position.x);
    pending.length = 0;
    result.set(key, position.x);
    end = position.x + position.width;
  }
  for (const missing of pending) result.set(missing, end);
  return result;
}
