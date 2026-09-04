import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import { build, preview, type PreviewServer } from "vite";
import type { BenchAPI, BenchKind, WorkloadResult } from "../demo/bench";

// Run with Bun. Vite builds the existing multi-page config before previewing it.
// BENCH_DURATION is workload milliseconds, not the animation duration.
// BENCH_ANIMATED=0 is a separate static-update workload, never pooled with motion.
const root = fileURLToPath(new URL("../", import.meta.url));

function numeric(name: string, fallback: number, min: number, max: number, integer = false) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} must be ${integer ? "an integer " : ""}between ${min} and ${max}`);
  }
  return value;
}

function flag(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value !== "0" && value !== "1") throw new Error(`${name} must be 0 or 1`);
  return value === "1";
}

const settings = {
  rounds: numeric("BENCH_ROUNDS", 7, 1, 100, true),
  warmupRounds: 1,
  count: numeric("BENCH_COUNT", 100, 1, 10000, true),
  duration: numeric("BENCH_DURATION", 1200, 1, 60000),
  hz: numeric("BENCH_HZ", 6, 0.1, 240),
  animationDuration: numeric("BENCH_ANIMATION_DURATION", 500, 1, 10000),
  animated: flag("BENCH_ANIMATED", true),
  headless: !flag("BENCH_HEADED", false),
  viewport: { width: 1440, height: 1000 },
};
const settleDuration = settings.animationDuration + 100;
const kinds: BenchKind[] = ["plain", "number-flow", "rolling-number"];

function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position);
  const left = sorted[low]!;
  return left + (sorted[Math.min(low + 1, sorted.length - 1)]! - left) * (position - low);
}

function spread(values: readonly number[]) {
  return {
    samples: values.length,
    median: percentile(values, 0.5),
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  };
}

type Metrics = Record<string, number>;
async function metrics(cdp: CDPSession): Promise<Metrics> {
  const response = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(response.metrics.map(({ name, value }) => [name, value]));
}

function delta(before: Metrics, after: Metrics) {
  const difference = (name: string) => {
    if (before[name] === undefined || after[name] === undefined) throw new Error(`CDP metric unavailable: ${name}`);
    return after[name] - before[name];
  };
  return {
    taskMs: difference("TaskDuration") * 1000,
    layoutMs: difference("LayoutDuration") * 1000,
    recalcStyleMs: difference("RecalcStyleDuration") * 1000,
    layoutCount: difference("LayoutCount"),
    recalcStyleCount: difference("RecalcStyleCount"),
  };
}

interface Sample {
  kind: BenchKind;
  round: number;
  order: number;
  mount: Awaited<ReturnType<BenchAPI["mount"]>> & ReturnType<typeof delta>;
  updateThroughSettlement: ReturnType<typeof delta>;
  workload: WorkloadResult;
  mounted: ReturnType<BenchAPI["snapshot"]>;
  settled: ReturnType<BenchAPI["snapshot"]>;
}

async function sample(page: Page, cdp: CDPSession, kind: BenchKind, round: number, order: number): Promise<Sample> {
  await page.evaluate(async () => { window.bench.destroy(); await window.bench.ready(); });
  // Normalize garbage from the prior renderer outside both measurement windows.
  await cdp.send("HeapProfiler.collectGarbage");
  const mountBefore = await metrics(cdp);
  const mount = await page.evaluate(async ({ kind, settings }) => {
    return window.bench.mount(kind, settings.count, settings.animated, { animationDuration: settings.animationDuration });
  }, { kind, settings });
  const mountAfter = await metrics(cdp);
  const mounted = await page.evaluate(() => window.bench.snapshot());
  if (mounted.activeAnimations) throw new Error(`${kind} has active animations after initial mount`);

  const before = await metrics(cdp);
  const workload = await page.evaluate(async ({ settings, settleDuration }) => {
    return window.bench.run({ duration: settings.duration, hz: settings.hz, settleDuration });
  }, { settings, settleDuration });
  const after = await metrics(cdp);
  // Tree traversal is outside the primary metric window; don't charge a renderer
  // for our shadow-DOM-aware instrumentation or finish animations to hide failure.
  const settled = await page.evaluate(() => window.bench.snapshot());
  if (!workload.documentVisibleThroughout) throw new Error("The document was backgrounded; discard this run");
  if (settled.activeAnimations) throw new Error(`${kind} did not settle (${settled.activeAnimations} active animations)`);
  if (settled.count !== settings.count) throw new Error(`${kind} lost counters during the workload`);
  return {
    kind,
    round,
    order,
    mount: { ...mount, ...delta(mountBefore, mountAfter) },
    updateThroughSettlement: delta(before, after),
    workload,
    mounted,
    settled,
  };
}

async function packageVersion(name?: string) {
  const path = name ? resolve(root, "node_modules", name, "package.json") : resolve(root, "package.json");
  const data: { version: string } = JSON.parse(await readFile(path, "utf8"));
  return data.version;
}

let browser: Browser | undefined;
let server: PreviewServer | undefined;
try {
  const referenceVersion = await packageVersion("number-flow");
  if (referenceVersion !== "0.6.2") throw new Error(`Expected number-flow@0.6.2, found ${referenceVersion}; update the comparison label and methodology before changing the baseline`);
  await build({ root: resolve(root, "demo"), configFile: resolve(root, "vite.config.ts"), logLevel: "warn" });
  server = await preview({
    root: resolve(root, "demo"),
    configFile: resolve(root, "vite.config.ts"),
    logLevel: "warn",
    preview: { host: "127.0.0.1", port: 0, open: false },
  });
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Vite preview did not open a TCP port");
  const url = `http://127.0.0.1:${address.port}/bench.html`;
  browser = await chromium.launch({ headless: settings.headless });
  const page = await browser.newPage({
    viewport: settings.viewport,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    locale: "en-US",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.bringToFront();
  await page.waitForFunction(() => Boolean(window.bench));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const environment = await page.evaluate(() => window.bench.environment());
  if (!environment.production) throw new Error("Refusing to benchmark Vite development modules");
  if (!environment.visible || environment.reducedMotion) throw new Error("Benchmark needs a visible document without reduced motion");
  if (settings.animated && !environment.numberFlowCanAnimate) throw new Error("NumberFlow cannot animate in this browser");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable", { timeDomain: "timeTicks" });
  const warmups: Sample[] = [];
  const samples: Sample[] = [];
  for (let round = -settings.warmupRounds; round < settings.rounds; round++) {
    const rotation = Math.floor(Math.max(0, round) / 2) % kinds.length;
    const rotated = [...kinds.slice(rotation), ...kinds.slice(0, rotation)];
    const order = round >= 0 && round % 2 === 1 ? rotated.reverse() : rotated;
    for (const [position, kind] of order.entries()) {
      const result = await sample(page, cdp, kind, round, position);
      if (round < 0) warmups.push(result);
      else samples.push(result);
      console.log(`${round < 0 ? "warmup" : `round ${round + 1}/${settings.rounds}`} ${kind}: ${result.updateThroughSettlement.taskMs.toFixed(2)} ms task time`);
      if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);
    }
  }

  const summaries = Object.fromEntries(kinds.map((kind) => {
    const selected = samples.filter((result) => result.kind === kind);
    const metricSummary = (phase: "mount" | "updateThroughSettlement") => Object.fromEntries(
      (["taskMs", "layoutMs", "recalcStyleMs", "layoutCount", "recalcStyleCount"] as const)
        .map((metric) => [metric, spread(selected.map((result) => result[phase][metric]))]),
    );
    return [kind, {
      mount: {
        ...metricSummary("mount"),
        synchronousMountMs: spread(selected.map((result) => result.mount.synchronousMountMs)),
        mountThroughFlushMs: spread(selected.map((result) => result.mount.mountThroughFlushMs)),
      },
      updateThroughSettlement: metricSummary("updateThroughSettlement"),
      elapsedMs: spread(selected.map((result) => result.workload.elapsedMs)),
      rafIntervalMedianMs: spread(selected.flatMap((result) => {
        const value = percentile(result.workload.rafIntervalsMs, 0.5);
        return value === null ? [] : [value];
      })),
      rafIntervalP95Ms: spread(selected.flatMap((result) => {
        const value = percentile(result.workload.rafIntervalsMs, 0.95);
        return value === null ? [] : [value];
      })),
      maxUpdateLatenessMs: spread(selected.map((result) => Math.max(...result.workload.updateLatenessMs))),
      mountedElementsIncludingShadowDOM: spread(selected.map((result) => result.mounted.elementsIncludingShadowDOM)),
      settledElementsIncludingShadowDOM: spread(selected.map((result) => result.settled.elementsIncludingShadowDOM)),
    }];
  }));

  const entryHtml = await readFile(resolve(server.config.root, server.config.build.outDir, "bench.html"));
  const result = {
    schemaVersion: 1,
    benchmark: "dom-carry-reversal-v1",
    recordedAt: new Date().toISOString(),
    versions: {
      rollingNumber: await packageVersion(),
      numberFlow: referenceVersion,
      playwright: await packageVersion("playwright"),
      vite: await packageVersion("vite"),
      browser: browser.version(),
      bun: process.versions.bun ?? null,
    },
    build: { mode: "production", entryHtmlSha256: createHash("sha256").update(entryHtml).digest("hex") },
    environment: {
      ...environment,
      headless: settings.headless,
      os: { platform: platform(), release: release(), arch: process.arch },
      cpu: { model: cpus()[0]?.model ?? "unknown", logicalCount: cpus().length },
      systemMemoryBytes: totalmem(),
      cpuThrottling: "none requested",
    },
    settings: { ...settings, settleDuration, initialValue: 999.98, sequence: await page.evaluate(() => [...window.bench.sequence]) },
    methodology: {
      primary: "CDP Performance.TaskDuration delta after mount, through scheduled updates, rAF flushes, and natural settlement; milliseconds of renderer main-thread task time, not wall time",
      mount: "Separate CDP delta around mount through two rAF callbacks; synchronous mount timing is diagnostic only",
      layoutAndStyle: "CDP LayoutDuration/RecalcStyleDuration deltas reported separately; these are components of task work and must not be added to it",
      raf: "Main-thread requestAnimationFrame callback intervals across workload and settlement; NOT compositor frames, FPS, or dropped-frame counts",
      elements: "All element descendants of the shared stage, including open shadow roots and common counter hosts; excludes stage itself, text nodes, pseudo-elements, and detached nodes",
      ordering: "One warmup per renderer excluded from summaries; measured rounds alternate forward/reverse order and rotate the first renderer every pair of rounds; same page; explicit garbage collection between samples outside measured windows",
      scheduling: "Fixed 6 Hz by default, first update at time zero, all scheduled updates submitted; lateness recorded rather than dropping delayed work",
      statistics: "Per-renderer medians, min/max, and interpolated p25/p75 across measured rounds; rAF summaries summarize each round's median/p95",
    },
    caveats: [
      "Plain text is a non-animated lower-bound reference, not an equivalent animation implementation.",
      "NumberFlow uses full directional wheels and accumulated effects; Rolling Number uses bounded travel and replacement springs. Equal target values and requested durations do not imply identical visuals.",
      "NumberFlow spin/layout easing matches the zero-velocity sampled spring; interruption velocity, travel distance, opacity timing, and layout paths may differ.",
      "NumberFlow's normal ungrouped DOM API is the baseline; no framework wrappers or custom cross-instance batching are added.",
      "Rolling Number offscreen pausing is disabled; NumberFlow checks element dimensions rather than viewport intersection. Large counts can extend below the viewport.",
      "CDP task time includes the benchmark scheduler and rAF observer as well as library work. The plain-text run exposes this common overhead.",
      "This is a warm steady-state update benchmark plus a separate warm mount measurement, not a cold-load, bundle-size, memory-leak, accessibility, or visual-quality test.",
      "Results characterize this workload, count, browser, environment, and versions only; no universal speed advantage is implied.",
    ],
    summaries,
    samples,
    warmups,
  };
  await mkdir(resolve(root, "perf"), { recursive: true });
  const output = resolve(root, "perf/results.local.json");
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Saved ${output}`);
} finally {
  try {
    await browser?.close();
  } finally {
    await server?.close();
  }
}
