import { mkdtemp, readFile, rm } from "node:fs/promises";
import { cpus, release, tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { build, preview, type PreviewServer } from "vite";

declare global {
  interface Window { boardAudio: { starts: number; active: number; state: () => string } }
}

// The real React PR board, with a fixed feed and clock. Each sample shifts the
// six rows twice, interrupting the first sweep, then lets every card settle.
const root = resolve(import.meta.dirname, "..");
const rounds = Number(process.env.BENCH_ROUNDS ?? 7);
if (!Number.isInteger(rounds) || rounds < 1) throw new Error("BENCH_ROUNDS must be a positive integer");
const animated = process.env.BENCH_ANIMATED !== "0";
const keepBuild = process.env.BENCH_KEEP_BUILD === "1";
const sound = process.env.BENCH_SOUND === "1";
const settings = { dataset: "pull-requests-v2", rounds, warmups: 1, animated, rows: 6, shifts: 2, interruptMs: 350, settleMs: 6000, viewport: { width: 1440, height: 1000 } };
const paths = [...new Bun.Glob("src/*").scanSync({ cwd: root }), "demo/board.tsx", "demo/board-sound.ts", "demo/pull-requests.ts", "demo/board.css", "demo/board.html", "demo/demo.css", "demo/install.ts", "vite.config.ts", "package.json", "bun.lock"].sort();
async function fingerprint() {
  const hash = new Bun.CryptoHasher("sha256");
  for (const path of paths) { hash.update(`${path}\0`); hash.update(await readFile(resolve(root, path))); }
  return hash.digest("hex");
}
const sourceSha256 = await fingerprint();
const outDir = await mkdtemp(resolve(process.env.BENCH_TMPDIR ?? tmpdir(), "rolling-number-board-"));
const servers: PreviewServer[] = [];
const browser = await chromium.launch();
let completed = false;

async function serve(directory: string) {
  const server = await preview({ root: resolve(root, "demo"), configFile: resolve(root, "vite.config.ts"), logLevel: "warn", build: { outDir: directory }, preview: { host: "127.0.0.1", port: 0, open: false } });
  servers.push(server);
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Preview did not open a TCP port");
  return `http://127.0.0.1:${address.port}/board.html?renderer=dom`;
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const board = document.querySelector(".board")!;
    const roots = [...board.querySelectorAll<HTMLElement>(".rn-root")];
    return {
      text: roots.map((node) => node.querySelector(".rn-value")!.textContent),
      elements: board.querySelectorAll("*").length,
      cards: board.querySelectorAll(".rn-flap").length,
      animations: board.getAnimations({ subtree: true }).length,
      // This settled-only geometry check is outside the task measurement window.
      correct: roots.every((node) => !node.hasAttribute("data-rn-ready") || [...node.querySelectorAll<HTMLElement>(".rn-slot")]
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .map((slot) => slot.querySelector(".rn-face")?.textContent).join("") === node.querySelector(".rn-value")!.textContent),
    };
  });
}

const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  return sorted[low]! + (sorted[Math.ceil(index)]! - sorted[low]!) * (index - low);
};
const spread = (values: number[]) => ({ median: percentile(values, .5), p25: percentile(values, .25), p75: percentile(values, .75), min: Math.min(...values), max: Math.max(...values) });

interface Sample {
  variant: string; round: number;
  taskMs: number; styleMs: number; layoutMs: number; rafP95Ms: number;
  elapsedMs: number; firstCards: number; activeElements: number; activeAnimations: number;
  activeSmears: number;
  audioSources: number;
  intervals: number[]; visible: boolean;
  settled: Awaited<ReturnType<typeof snapshot>>;
}

try {
  process.env.FLAP_BOARD = "1";
  await build({ root: resolve(root, "demo"), configFile: resolve(root, "vite.config.ts"), logLevel: "warn", build: { outDir } });
  if (await fingerprint() !== sourceSha256) throw new Error("Source changed during build; discard this capture");
  const artifact = { directory: outDir, sourceSha256, flapSha256: new Bun.CryptoHasher("sha256").update(await readFile(resolve(root, "src/flap.ts"))).digest("hex") };
  const url = await serve(outDir);
  const variants = [{ name: "current", url, artifact, sound, fullBlur: false }];
  if (sound) variants.unshift({ name: "silent", url, artifact, sound: false, fullBlur: false });
  if (process.env.BENCH_COMPARE_BLUR === "1") variants.unshift({ name: "full-blur", url, artifact, sound: false, fullBlur: true });
  for (const [name, path] of [["baseline", process.env.BENCH_BASELINE], ["reference", process.env.BENCH_REFERENCE]] as const) {
    if (!path) continue;
    const baseline = await Bun.file(path).json();
    if (JSON.stringify(baseline.settings) !== JSON.stringify(settings)) throw new Error("Baseline workload settings must match");
    await readFile(resolve(baseline.artifact.directory, "board.html"));
    variants.unshift({ name, url: await serve(baseline.artifact.directory), artifact: baseline.artifact, sound: false, fullBlur: false });
  }
  const samples: Sample[] = [];
  const warmups: Sample[] = [];
  let expectedText: unknown;
  for (let round = -1; round < rounds; round++) {
    // Rotate after each forward/reverse pair. Rotating every round cancels the
    // reversal with two variants and accidentally always runs the same one first.
    const offset = Math.floor(Math.max(0, round) / 2) % variants.length;
    const rotated = [...variants.slice(offset), ...variants.slice(0, offset)];
    const order = round % 2 === 0 ? rotated : rotated.reverse();
    for (const variant of order) {
      const page = await browser.newPage({ viewport: settings.viewport, deviceScaleFactor: 1, reducedMotion: "no-preference", locale: "en-US", timezoneId: "UTC" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        Math.random = () => .314159;
        // Override Date only. Playwright's clock also virtualizes timer/rAF time,
        // which can diverge from the native WAAPI timeline under this workload.
        const NativeDate = Date;
        const fixed = NativeDate.parse("2026-09-04T12:00:00Z");
        const now = () => fixed;
        globalThis.Date = new Proxy(NativeDate, {
          apply: () => new NativeDate(fixed).toString(),
          construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [fixed], newTarget),
          get: (target, key, receiver) => key === "now" ? now : Reflect.get(target, key, receiver),
        });
        const NativeAudioContext = AudioContext;
        window.boardAudio = { starts: 0, active: 0, state: () => "off" };
        window.AudioContext = class extends NativeAudioContext {
          constructor() { super(); window.boardAudio.state = () => this.state; }
          override createBufferSource() {
            const source = super.createBufferSource();
            const start = source.start.bind(source);
            source.start = (...args) => {
              window.boardAudio.starts++; window.boardAudio.active++;
              source.addEventListener("ended", () => window.boardAudio.active--, { once: true });
              start(...args);
            };
            return source;
          }
        };
      });
      await page.goto(variant.url, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      if (variant.fullBlur) await page.getByRole("checkbox", { name: "Full-board blur" }).check();
      if (variant.sound) {
        await page.getByRole("button", { name: "Sound", exact: true }).click();
        await page.waitForFunction(() => window.boardAudio.state() === "running");
      }
      if (!animated) await page.getByRole("checkbox", { name: "Reduce motion" }).check();
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
      const initial = await snapshot(page);
      if (initial.cards || initial.animations || !initial.correct) throw new Error("Board did not mount at rest");
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Performance.enable");
      await cdp.send("HeapProfiler.collectGarbage");
      const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
      const before = await metrics();
      const observed = await page.evaluate(async ({ interruptMs, settleMs }) => {
        const board = document.querySelector(".board")!;
        const next = [...document.querySelectorAll("button")].find((button) => button.textContent === "Next PR")!;
        const intervals: number[] = [];
        let last: number | undefined;
        let frame = 0;
        let visible = !document.hidden;
        const onVisibility = () => { if (document.hidden) visible = false; };
        document.addEventListener("visibilitychange", onVisibility);
        const tick = (time: number) => { if (last !== undefined) intervals.push(time - last); last = time; frame = requestAnimationFrame(tick); };
        frame = requestAnimationFrame(tick);
        const flush = async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); };
        const start = performance.now();
        try {
          next.click();
          await flush();
          const firstCards = board.querySelectorAll(".rn-flap").length;
          await new Promise((resolve) => setTimeout(resolve, interruptMs));
          next.click();
          await flush();
          const activeElements = board.querySelectorAll("*").length;
          const activeAnimations = board.getAnimations({ subtree: true }).length;
          const activeSmears = board.querySelectorAll(".rn-flap-smear").length;
          await new Promise((resolve) => setTimeout(resolve, settleMs));
          // Let native finish events run before checking cleanup, as in bench.ts.
          await flush();
          return { elapsedMs: performance.now() - start, firstCards, activeElements, activeAnimations, activeSmears, intervals, visible, audioSources: window.boardAudio.starts };
        } finally { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", onVisibility); }
      }, settings);
      const after = await metrics();
      const settled = await snapshot(page);
      if (errors.length || !observed.visible || settled.animations || settled.cards || !settled.correct) {
        const playback = await page.evaluate(() => document.querySelector(".board")!.getAnimations({ subtree: true }).slice(0, 8).map((animation) => ({ state: animation.playState, time: animation.currentTime, timing: animation.effect!.getComputedTiming() })));
        throw new Error(`Invalid board sample: ${JSON.stringify({ variant: variant.name, round, errors, visible: observed.visible, settled, playback })}`);
      }
      if (animated && (!observed.firstCards || !observed.activeAnimations)) throw new Error("Flaps did not animate");
      if (!animated && (observed.firstCards || observed.activeAnimations)) throw new Error("Static board unexpectedly animated");
      if ((observed.activeSmears > 0) !== (variant.fullBlur && animated)) throw new Error("Blur did not match the requested workload");
      if (observed.audioSources > 0 !== (variant.sound && animated)) throw new Error("Audio did not match the requested workload");
      if (await page.evaluate(() => window.boardAudio.active)) throw new Error("Audio did not settle");
      expectedText ??= settled.text;
      if (JSON.stringify(expectedText) !== JSON.stringify(settled.text)) throw new Error("Schedule changed between samples");
      const delta = (name: string) => {
        if (before[name] === undefined || after[name] === undefined) throw new Error(`Missing CDP metric: ${name}`);
        return (after[name] - before[name]) * 1000;
      };
      const sample = { variant: variant.name, round, taskMs: delta("TaskDuration"), styleMs: delta("RecalcStyleDuration"), layoutMs: delta("LayoutDuration"), rafP95Ms: percentile(observed.intervals, .95), ...observed, settled };
      (round < 0 ? warmups : samples).push(sample);
      console.log(`${round < 0 ? "warmup" : `round ${round + 1}/${rounds}`} ${variant.name}: ${sample.taskMs.toFixed(2)} ms task; ${sample.activeElements} active elements; rAF p95 ${sample.rafP95Ms.toFixed(2)} ms`);
      await page.close();
    }
  }
  const summaries = Object.fromEntries(variants.map(({ name }) => {
    const group = samples.filter((sample) => sample.variant === name);
    return [name, Object.fromEntries((["taskMs", "styleMs", "layoutMs", "rafP95Ms", "activeElements", "activeAnimations", "activeSmears"] as const).map((metric) => [metric, spread(group.map((sample) => sample[metric]))]))];
  }));
  const result = {
    benchmark: "pull-request-board-interruption-v2", recordedAt: new Date().toISOString(), settings, artifact,
    variants: variants.map(({ name, artifact, sound, fullBlur }) => ({ name, artifact, sound, fullBlur })),
    environment: { browser: browser.version(), bun: Bun.version, os: process.platform, release: release(), arch: process.arch, cpu: cpus()[0]?.model, build: "production", clock: "Date fixed at 2026-09-04T12:00:00Z; native performance/timers unchanged", seed: .314159 },
    methodology: "CDP task time includes two React PR-feed shifts, two-frame flushes, interruption wait, 6000 ms natural settlement plus a final two-frame finish-event flush, rAF observer and active DOM snapshots. Final glyph/geometry checks and GC are outside measurement. One discarded warmup per variant; seven rounds by default, rotating/reversing variant order. Baseline results are never pooled from a previous run: only its build is reused. The PR dataset is not comparable to the old departure dataset. rAF intervals are not presented FPS. Static mode is a separate workload.",
    summaries, samples, warmups,
  };
  await Bun.write(resolve(root, process.env.BENCH_OUTPUT ?? "perf/flap-board.local.json"), `${JSON.stringify(result, null, 2)}\n`);
  for (const [name, summary] of Object.entries(summaries)) console.log(`METRIC variant=${name} board_task_ms=${summary.taskMs!.median.toFixed(2)} raf_p95_ms=${summary.rafP95Ms!.median.toFixed(2)}`);
  if (keepBuild) console.log(`Retained isolated build: ${outDir}`);
  completed = true;
} finally {
  try { await browser.close(); }
  finally {
    try { await Promise.all(servers.map((server) => server.close())); }
    finally { if (!keepBuild || !completed) await rm(outDir, { recursive: true, force: true }); }
  }
}
