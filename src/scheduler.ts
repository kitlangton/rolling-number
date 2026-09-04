export interface Participant {
  stage(): (() => void) | undefined;
  measure(): (() => void) | undefined;
  refresh(): void;
  visibility(visible: boolean): void;
  preferenceChanged(): void;
  sizeChanged(element: Element, width: number, height: number): boolean;
}

type Browser = Window & typeof globalThis;
const schedulers = new WeakMap<Window, Scheduler>();

/** Shared across counters: one frame, resize observer, intersection observer and listener set. */
export class Scheduler {
  readonly media: MediaQueryList;
  private members = new Set<Participant>();
  private pending = new Set<Participant>();
  private sizes = new WeakMap<Element, Participant>();
  private intersections = new WeakMap<Element, Participant>();
  private resize: ResizeObserver | undefined;
  private intersection: IntersectionObserver | undefined;
  private frame = 0;

  static for(view: Browser): Scheduler {
    let scheduler = schedulers.get(view);
    if (!scheduler) {
      scheduler = new Scheduler(view);
      schedulers.set(view, scheduler);
    }
    return scheduler;
  }

  private constructor(private view: Browser) {
    this.media = view.matchMedia("(prefers-reduced-motion: reduce)");
    this.media.addEventListener("change", this.preferences);
    view.document.addEventListener("visibilitychange", this.preferences);
    view.document.fonts?.addEventListener("loadingdone", this.fonts);
    void view.document.fonts?.ready.then(() => this.fonts());
    if (view.ResizeObserver) this.resize = new view.ResizeObserver((entries) => {
      for (const entry of entries) {
        const owner = this.sizes.get(entry.target);
        if (owner?.sizeChanged(entry.target, entry.contentRect.width, entry.contentRect.height)) owner.refresh();
      }
    });
    if (view.IntersectionObserver) this.intersection = new view.IntersectionObserver((entries) => {
      for (const entry of entries) this.intersections.get(entry.target)?.visibility(entry.isIntersecting);
    }, { rootMargin: "64px" });
  }

  private preferences = (): void => { for (const member of this.members) member.preferenceChanged(); };
  private fonts = (): void => { for (const member of this.members) member.refresh(); };

  add(owner: Participant, host: Element): void {
    this.members.add(owner);
    this.intersections.set(host, owner);
    this.intersection?.observe(host);
  }

  watch(element: Element, owner: Participant): void {
    this.sizes.set(element, owner);
    this.resize?.observe(element);
  }

  unwatch(element: Element): void {
    this.resize?.unobserve(element);
    this.sizes.delete(element);
  }

  enqueue(owner: Participant): void {
    this.pending.add(owner);
    if (!this.frame) this.frame = this.view.requestAnimationFrame(() => {
      this.frame = 0;
      const pending = [...this.pending];
      this.pending.clear();
      // Capture old positions before any intrinsic-width writes, across all adapters.
      const stages = pending.map((member) => member.stage());
      for (const stage of stages) stage?.();
      // Measure target positions as a second batch, then start native playback.
      const commits = pending.map((member) => member.measure());
      for (const commit of commits) commit?.();
    });
  }

  remove(owner: Participant, host: Element): void {
    this.pending.delete(owner);
    this.members.delete(owner);
    this.intersection?.unobserve(host);
    this.intersections.delete(host);
    if (this.members.size) return;
    this.view.cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    this.intersection?.disconnect();
    this.media.removeEventListener("change", this.preferences);
    this.view.document.removeEventListener("visibilitychange", this.preferences);
    this.view.document.fonts?.removeEventListener("loadingdone", this.fonts);
    schedulers.delete(this.view);
  }
}
