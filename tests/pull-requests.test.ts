import { expect, it } from "vitest";
import { advance, queue, statuses, titles, titleWidth } from "../demo/pull-requests";

it("keeps simulated PRs inside their fixed field capacities", () => {
  for (const seed of [0, 7999, 314159, 999999]) {
    const requests = queue(seed);
    expect(requests).toHaveLength(6);
    for (const request of requests) {
      expect(request.number).toBeGreaterThanOrEqual(1000);
      expect(request.number).toBeLessThan(10000);
      expect(titles).toContain(request.title);
      expect(request.title.length).toBeLessThanOrEqual(titleWidth);
      expect(request.comments).toBeGreaterThanOrEqual(0);
      expect(request.comments).toBeLessThan(100);
      expect(statuses).toContain(request.status);
      expect(request.status.length).toBeLessThanOrEqual(9);
    }
    expect(queue(seed)).toEqual(requests);
  }
});

it("advances without mutating the old feed and wraps a four-digit PR number", () => {
  const before = queue(314159);
  before[5] = { ...before[5]!, number: 9999 };
  const after = advance(before, 314166);
  expect(after.slice(0, 5)).toEqual(before.slice(1));
  expect(before[5]!.number).toBe(9999);
  expect(after[5]!.number).toBe(1000);
});
