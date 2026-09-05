export interface PullRequest { number: number; title: string; comments: number; status: string }

export const titles = ["FIX THE FIX", "REVERT REVERT", "ONE LAST NIT", "REMOVE TODO", "UPDATE LOCKFILE", "ADD DARK MODE", "RENAME THINGS", "SHIP IT", "FIX FLAKY TEST", "LESS JAVASCRIPT", "CACHE THE CACHE", "ACTUALLY FIX CI", "BUMP EVERYTHING"];
export const titleWidth = Math.max(...titles.map((title) => title.length));
export const statuses = ["IN REVIEW", "APPROVED", "CHANGES", "CI FAILED", "DRAFT", "MERGING"];
export const rowCount = 6;

/** Reproducible fictional data; this module never reads or changes GitHub. */
export function queue(seed: number): PullRequest[] {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: rowCount }, (_, index) => ({
    number: 1000 + seed % 8000 + index,
    title: titles[Math.floor(next() * titles.length)]!,
    comments: Math.floor(next() * 25),
    status: statuses[Math.floor(next() * statuses.length)]!,
  }));
}

/** Rotate the feed, retaining its four-digit PR-number capacity. */
export function advance(board: PullRequest[], seed: number): PullRequest[] {
  const [fresh] = queue(seed + board.length);
  const last = board.at(-1)!;
  return [...board.slice(1), { ...fresh!, number: last.number === 9999 ? 1000 : last.number + 1 }];
}
