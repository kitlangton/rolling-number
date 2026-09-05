import { expect, it, vi } from "vitest";
import { Scheduler, type Participant } from "../src/scheduler";

it("shares invalidation across preferences and fonts, then removes every listener", async () => {
  let fontsReady!: () => void;
  const media = new EventTarget();
  const fonts = Object.assign(new EventTarget(), { ready: new Promise<void>((resolve) => { fontsReady = resolve; }) });
  const document = Object.assign(new EventTarget(), { fonts });
  const subscriptions = ([[media, "change"], [document, "visibilitychange"], [fonts, "loadingdone"]] as const).map(([target, type]) => ({
    type, add: vi.spyOn(target, "addEventListener"), remove: vi.spyOn(target, "removeEventListener"),
  }));
  const view = { document, matchMedia: () => media, cancelAnimationFrame: vi.fn() } as unknown as Parameters<typeof Scheduler.for>[0];
  const participant = (): Participant => ({ stage: () => undefined, measure: () => undefined, refresh: vi.fn(), visibility: vi.fn(), sizeChanged: () => false });
  const first = participant(), second = participant();
  const firstHost = {} as Element, secondHost = {} as Element;
  const scheduler = Scheduler.for(view);
  scheduler.add(first, firstHost);
  scheduler.add(second, secondHost);
  expect(Scheduler.for(view)).toBe(scheduler);
  fontsReady();
  await fonts.ready;
  expect(first.refresh).toHaveBeenCalledTimes(1);
  const invalidate = () => {
    media.dispatchEvent(new Event("change"));
    document.dispatchEvent(new Event("visibilitychange"));
    fonts.dispatchEvent(new Event("loadingdone"));
  };
  invalidate();
  expect(first.refresh).toHaveBeenCalledTimes(4);
  expect(second.refresh).toHaveBeenCalledTimes(4);
  scheduler.remove(first, firstHost);
  invalidate();
  expect(first.refresh).toHaveBeenCalledTimes(4);
  expect(second.refresh).toHaveBeenCalledTimes(7);
  for (const { remove } of subscriptions) expect(remove).not.toHaveBeenCalled();
  scheduler.remove(second, secondHost);
  invalidate();
  expect(second.refresh).toHaveBeenCalledTimes(7);
  for (const { type, add, remove } of subscriptions) {
    expect(add).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledWith(type, expect.any(Function));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(type, add.mock.calls[0]![1]);
  }
});
