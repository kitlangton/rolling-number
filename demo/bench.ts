import NumberFlow, { canAnimate } from "number-flow";
import { createRollingNumber } from "../src/index";
import "../src/styles.css";

export type BenchKind = "plain" | "number-flow" | "rolling-number";

export interface BenchSettings {
  animationDuration: number;
}

export interface WorkloadOptions {
  duration: number;
  hz: number;
  settleDuration: number;
}

export interface WorkloadResult {
  elapsedMs: number;
  updateCount: number;
  finalValue: number;
  updateOffsetsMs: number[];
  updateLatenessMs: number[];
  rafIntervalsMs: number[];
  documentVisibleThroughout: boolean;
}

interface Counter {
  update(value: number): void;
  finish(): void;
  destroy(): void;
  refresh(): void;
}

export interface BenchAPI {
  /** Actual renderer hosts inside identical fixed-height grid cells. */
  readonly counters: readonly HTMLElement[];
  readonly sequence: readonly number[];
  mount(kind: BenchKind, count: number, animated?: boolean, settings?: Partial<BenchSettings>): Promise<{
    synchronousMountMs: number;
    mountThroughFlushMs: number;
  }>;
  update(value: number): void;
  finish(): void;
  destroy(): void;
  refresh(): void;
  ready(): Promise<void>;
  run(options?: Partial<WorkloadOptions>): Promise<WorkloadResult>;
  snapshot(): {
    kind: BenchKind | null;
    count: number;
    elementsIncludingShadowDOM: number;
    activeAnimations: number;
  };
  environment(): {
    production: boolean;
    numberFlowCanAnimate: boolean;
    visible: boolean;
    reducedMotion: boolean;
    devicePixelRatio: number;
    userAgent: string;
    viewport: { width: number; height: number };
    font: string;
    fontVariantNumeric: string;
    numberFlowEasing: string;
    format: Intl.NumberFormatOptions;
    locale: string;
  };
}

/** Browser-test contract. Import this file's types with `import type` in runners. */
declare global {
  interface Window {
    bench: BenchAPI;
  }
}

const stage = document.querySelector<HTMLElement>("#bench-stage")!;
const output = document.querySelector<HTMLElement>("#bench-output")!;
const locale = "en-US";
const format = { minimumFractionDigits: 2, maximumFractionDigits: 2 } satisfies Intl.NumberFormatOptions;
const formatter = new Intl.NumberFormat(locale, format);
const initialValue = 999.98;
const sequence = [999.99, 1000, 999.99, 1000.01, 999.98, 1000, 1000.01, 999.99];

// Match Rolling Number's zero-velocity, critically damped starting trajectory.
// This does not claim equal trajectories after an interruption: the engines
// preserve/compose motion differently and may traverse different digit faces.
const easing = `linear(${Array.from({ length: 49 }, (_, index) => {
  const t = index / 48;
  return index === 48 ? 1 : 1 - (1 + 10 * t) * Math.exp(-10 * t);
}).join(",")})`;

let hosts: HTMLElement[] = [];
let counters: Counter[] = [];
let kind: BenchKind | null = null;
let animationDuration = 500;
let runController: AbortController | undefined;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Two frames allow a scheduled update, its native animation setup, and observer
// delivery to run. This is deliberately not a synchronous submission timer.
async function ready() {
  await nextFrame();
  await nextFrame();
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, Math.max(0, ms));
    signal.addEventListener("abort", abort, { once: true });
  });
}

function destroy() {
  runController?.abort(new DOMException("Benchmark destroyed", "AbortError"));
  counters.forEach((counter) => counter.destroy());
  counters = [];
  hosts = [];
  kind = null;
  stage.replaceChildren();
}

const bench: BenchAPI = {
  get counters() { return hosts; },
  sequence,
  async mount(nextKind, count, animated = true, settings = {}) {
    if (!["plain", "number-flow", "rolling-number"].includes(nextKind)) throw new Error("Unknown renderer");
    if (!Number.isInteger(count) || count < 1 || count > 10000) throw new Error("Counter count must be 1–10000");
    const duration = settings.animationDuration ?? 500;
    if (!Number.isFinite(duration) || duration < 0 || duration > 10000) throw new Error("Invalid animation duration");
    destroy();
    await document.fonts.ready;
    kind = nextKind;
    animationDuration = duration;
    const started = performance.now();
    const fragment = document.createDocumentFragment();
    hosts = Array.from({ length: count }, () => {
      const cell = document.createElement("span");
      cell.className = "bench-counter";
      const host = document.createElement("span");
      host.className = "bench-value";
      cell.append(host);
      fragment.append(cell);
      return host;
    });
    stage.append(fragment);
    for (const host of hosts) {
      if (nextKind === "plain") {
        host.textContent = formatter.format(initialValue);
        counters.push({
          update: (value) => { host.textContent = formatter.format(value); },
          finish() {},
          destroy() { host.replaceChildren(); },
          refresh() {},
        });
      } else if (nextKind === "number-flow") {
        const flow = new NumberFlow();
        flow.locales = locale;
        flow.format = format;
        flow.animated = animated;
        flow.transformTiming = { duration, easing };
        flow.spinTiming = { duration, easing };
        flow.opacityTiming = { duration, easing: "ease-out" };
        host.append(flow);
        flow.update(initialValue);
        const finish = () => flow.shadowRoot?.getAnimations().forEach((animation) => animation.finish());
        counters.push({
          update: (value) => flow.update(value),
          finish,
          destroy() { finish(); flow.remove(); },
          refresh() {},
        });
      } else {
        const rolling = createRollingNumber(host, {
          value: initialValue,
          locales: locale,
          format,
          duration,
          animated,
          pauseOffscreen: false,
        });
        counters.push({
          update: (value) => rolling.update({ value }),
          finish: () => rolling.finish(),
          destroy: () => rolling.destroy(),
          refresh: () => rolling.refresh(),
        });
      }
    }
    const synchronousMountMs = performance.now() - started;
    await ready();
    return { synchronousMountMs, mountThroughFlushMs: performance.now() - started };
  },
  update(value) { counters.forEach((counter) => counter.update(value)); },
  finish() { counters.forEach((counter) => counter.finish()); },
  destroy,
  refresh() { counters.forEach((counter) => counter.refresh()); },
  ready,
  async run(options = {}) {
    if (!counters.length) throw new Error("Mount counters before running a workload");
    if (runController) throw new Error("A workload is already running");
    const duration = options.duration ?? 1200;
    const hz = options.hz ?? 6;
    const settleDuration = options.settleDuration ?? animationDuration + 100;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60000) throw new Error("Invalid workload duration");
    if (!Number.isFinite(hz) || hz <= 0 || hz > 240) throw new Error("Invalid update frequency");
    if (!Number.isFinite(settleDuration) || settleDuration < animationDuration) throw new Error("Settlement must cover animation duration");
    const controller = new AbortController();
    runController = controller;
    const started = performance.now();
    const updateOffsetsMs: number[] = [];
    const updateLatenessMs: number[] = [];
    const rafIntervalsMs: number[] = [];
    let lastFrame: number | undefined;
    let raf = 0;
    let finalValue = initialValue;
    let documentVisibleThroughout = document.visibilityState === "visible";
    const onVisibility = () => { if (document.visibilityState !== "visible") documentVisibleThroughout = false; };
    document.addEventListener("visibilitychange", onVisibility);
    const frame = (time: number) => {
      if (lastFrame !== undefined) rafIntervalsMs.push(time - lastFrame);
      lastFrame = time;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    try {
      const interval = 1000 / hz;
      for (let index = 0; index * interval < duration; index++) {
        const target = started + index * interval;
        await wait(target - performance.now(), controller.signal);
        const now = performance.now();
        updateOffsetsMs.push(now - started);
        updateLatenessMs.push(Math.max(0, now - target));
        finalValue = sequence[index % sequence.length]!;
        bench.update(finalValue);
      }
      await wait(started + duration - performance.now(), controller.signal);
      // Batched renderers may not have committed the final target yet under load.
      // Start the equal settlement window after both engines have had a frame.
      await ready();
      await wait(settleDuration, controller.signal);
      await ready();
      controller.signal.throwIfAborted();
      return {
        elapsedMs: performance.now() - started,
        updateCount: updateOffsetsMs.length,
        finalValue,
        updateOffsetsMs,
        updateLatenessMs,
        rafIntervalsMs,
        documentVisibleThroughout,
      };
    } finally {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      if (runController === controller) runController = undefined;
    }
  },
  snapshot() {
    let elementsIncludingShadowDOM = 0;
    const animations = new Set(stage.getAnimations({ subtree: true }));
    const visit = (root: Element | ShadowRoot) => {
      for (const child of root.children) {
        elementsIncludingShadowDOM++;
        visit(child);
        if (child.shadowRoot) {
          child.shadowRoot.getAnimations().forEach((animation) => animations.add(animation));
          visit(child.shadowRoot);
        }
      }
    };
    visit(stage);
    return {
      kind,
      count: hosts.length,
      elementsIncludingShadowDOM,
      activeAnimations: [...animations].filter((animation) => animation.playState !== "finished" && animation.playState !== "idle").length,
    };
  },
  environment() {
    const style = getComputedStyle(stage);
    return {
      production: import.meta.env.PROD,
      numberFlowCanAnimate: canAnimate,
      visible: document.visibilityState === "visible",
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      devicePixelRatio,
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily}`,
      fontVariantNumeric: style.fontVariantNumeric,
      numberFlowEasing: easing,
      format,
      locale,
    };
  },
};

window.bench = bench;

const controls = document.querySelector<HTMLFormElement>("#bench-controls")!;
function reportError(error: unknown) { output.textContent = String(error); }
controls.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(controls);
  const selected = String(data.get("kind")) as BenchKind;
  void bench.mount(selected, Number(data.get("count")), data.get("animated") === "1")
    .then((result) => { output.textContent = JSON.stringify({ ...result, ...bench.snapshot() }, null, 2); })
    .catch(reportError);
});
document.querySelector("#bench-play")!.addEventListener("click", () => {
  output.textContent = "Playing workload; this preview does not collect CDP task-time metrics.";
  void bench.run().then((result) => {
    output.textContent = JSON.stringify({ ...result, snapshot: bench.snapshot() }, null, 2);
  }).catch(reportError);
});
document.querySelector("#bench-clear")!.addEventListener("click", () => {
  bench.destroy();
  output.textContent = "Cleared.";
});
