export interface Position { x: number; width: number }

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
