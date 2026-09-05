import { mkdtemp, readFile, rm } from "node:fs/promises";
import { cpus, release, tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { build, preview, type PreviewServer } from "vite";

// Actual production React range handler: 120 inputs at native frame cadence.
const rounds = Number(process.env.BENCH_ROUNDS ?? 7);
const pointer = process.env.BENCH_POINTER === "1";
if (!Number.isInteger(rounds) || rounds < 1) throw new Error("BENCH_ROUNDS must be positive");
const settings = { rounds, updates: 120, settleMs: 650, viewport: { width: 1280, height: 900 }, ...(pointer ? { input: "native-pointer-160-moves" } : {}) };

declare global {
  interface Window {
    pointerProbe: { intervals: number[]; last: number; frame: number; stalled: number; retargets: number; visible: boolean; stop: () => void };
  }
}

async function drag(page: Page) {
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    const probe = window.pointerProbe = { intervals: [] as number[], last: 0, frame: 0, stalled: 0, retargets: 0, visible: !document.hidden, stop: () => {} };
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.matches(".scrub-number .rn-reel")) {
        const created = Number(document.timeline.currentTime);
        const cancel = animation.cancel.bind(animation);
        animation.cancel = () => {
          if (Number(document.timeline.currentTime) > created) {
            probe.retargets++;
            if (animation.currentTime === 0) probe.stalled++;
          }
          cancel();
        };
      }
      return animation;
    };
    const hidden = () => { if (document.hidden) probe.visible = false; };
    document.addEventListener("visibilitychange", hidden);
    const tick = (time: number) => {
      if (probe.last) probe.intervals.push(time - probe.last);
      probe.last = time; probe.frame = requestAnimationFrame(tick);
    };
    probe.frame = requestAnimationFrame(tick);
    probe.stop = () => { cancelAnimationFrame(probe.frame); Element.prototype.animate = animate; document.removeEventListener("visibilitychange", hidden); };
  });
  const start = performance.now();
  const box = (await page.getByRole("slider", { name: "Distance", exact: true }).boundingBox())!;
  try {
    await page.mouse.move(box.x + box.width * .4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2, { steps: 80 });
    await page.mouse.move(box.x + box.width * .2, box.y + box.height / 2, { steps: 80 });
    await page.mouse.up();
    const result = await page.evaluate(() => {
      const p = window.pointerProbe;
      p.stop();
      return { intervals: p.intervals, stalled: p.stalled, retargets: p.retargets, visible: p.visible, active: document.querySelector(".scrub-number")!.getAnimations({ subtree: true }).length };
    });
    await page.waitForTimeout(settings.settleMs);
    return { ...result, elapsedMs: performance.now() - start };
  } finally { await page.evaluate(() => window.pointerProbe.stop()); }
}
const paths = [...new Bun.Glob("{src,demo}/*").scanSync(), "vite.config.ts", "package.json", "bun.lock"].sort();
async function fingerprint() {
  const hash = new Bun.CryptoHasher("sha256");
  for (const path of paths) { hash.update(`${path}\0`); hash.update(await readFile(path)); }
  return hash.digest("hex");
}
const sourceSha256 = await fingerprint();
const directory = await mkdtemp(resolve(process.env.BENCH_TMPDIR ?? tmpdir(), "rolling-number-scrub-"));
const servers: PreviewServer[] = [];
const browser = await chromium.launch();
let completed = false;

async function serve(outDir: string) {
  const server = await preview({ configFile: "vite.config.ts", logLevel: "warn", build: { outDir }, preview: { host: "127.0.0.1", port: 0, open: false } });
  servers.push(server);
  const address = server.httpServer.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  return `http://127.0.0.1:${address.port}/`;
}

async function measure(page: Page, url: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("slider", { name: "Distance", exact: true }).scrollIntoViewIfNeeded();
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
  const before = await metrics();
  const result = pointer ? await drag(page) : await page.evaluate(async ({ updates, settleMs }) => {
    const input = document.querySelector<HTMLInputElement>('[aria-label="Distance"]')!;
    const number = document.querySelector<HTMLElement>(".scrub-number")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const intervals: number[] = [];
    const started = performance.now();
    let last: number | undefined;
    let active = 0;
    let visible = !document.hidden;
    const hidden = () => { if (document.hidden) visible = false; };
    document.addEventListener("visibilitychange", hidden);
    input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    try {
      await new Promise<void>((resolve) => {
        let index = 0;
        function update(time: number) {
          if (last !== undefined) intervals.push(time - last);
          last = time;
          const value = index === updates - 1 ? 95724 : Math.round(60000 + 48000 * Math.sin(index / 12));
          setValue.call(input, String(value));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          if (++index === updates) resolve();
          else requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
      });
      await new Promise(requestAnimationFrame);
      active = number.getAnimations({ subtree: true }).length;
      input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, settleMs));
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
      return { intervals, active, elapsedMs: performance.now() - started, visible, stalled: 0, retargets: 0 };
    } finally { document.removeEventListener("visibilitychange", hidden); }
  }, settings);
  const after = await metrics();
  const final = await page.evaluate(() => {
    const number = document.querySelector(".scrub-number")!;
    return {
      value: document.querySelector<HTMLInputElement>('[aria-label="Distance"]')!.value,
      text: number.querySelector(".rn-semantic")!.textContent,
      glyphs: [...number.querySelectorAll(".rn-slot")].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map((node) => node.querySelector(".rn-face")?.textContent).join(""),
      animations: number.getAnimations({ subtree: true }).length,
    };
  });
  const expected = `${new Intl.NumberFormat("en-US").format(Number(final.value))} km`;
  if (errors.length || !result.visible || !result.active || final.animations || (!pointer && final.value !== "95724") || final.text !== expected || final.text !== final.glyphs) throw new Error(`Invalid scrub sample: ${JSON.stringify({ errors, result, final })}`);
  const delta = (name: string) => { if (after[name] === undefined || before[name] === undefined) throw new Error(`Missing metric ${name}`); return (after[name] - before[name]) * 1000; };
  return { taskMs: delta("TaskDuration"), styleMs: delta("RecalcStyleDuration"), layoutMs: delta("LayoutDuration"), rafP95Ms: percentile(result.intervals, .95), ...result };
}
function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  return sorted[Math.floor(index)]! + (sorted[Math.ceil(index)]! - sorted[Math.floor(index)]!) * (index % 1);
}
const spread = (values: number[]) => ({ median: percentile(values, .5), p25: percentile(values, .25), p75: percentile(values, .75), min: Math.min(...values), max: Math.max(...values) });

try {
  await build({ configFile: "vite.config.ts", logLevel: "warn", build: { outDir: directory } });
  if (await fingerprint() !== sourceSha256) throw new Error("Source changed during build");
  const artifact = { directory, sourceSha256 };
  const variants = [{ name: "current", url: await serve(directory), artifact }];
  if (process.env.BENCH_BASELINE) {
    const baseline = await Bun.file(process.env.BENCH_BASELINE).json();
    // Only the retained artifact is reused; pointer mode runs the new driver on
    // both builds. Never pool measurements from the older synthetic-input loop.
    if (JSON.stringify(pointer ? settings.viewport : settings) !== JSON.stringify(pointer ? baseline.settings.viewport : baseline.settings)) throw new Error("Workload changed");
    variants.unshift({ name: "baseline", url: await serve(baseline.artifact.directory), artifact: baseline.artifact });
  }
  const samples: Array<Awaited<ReturnType<typeof measure>> & { variant: string; round: number }> = [];
  const warmups: typeof samples = [];
  for (let round = -1; round < rounds; round++) {
    for (const variant of round % 2 === 0 ? variants : [...variants].reverse()) {
      const page = await browser.newPage({ viewport: settings.viewport, deviceScaleFactor: 1, locale: "en-US", reducedMotion: "no-preference" });
      const sample = { ...await measure(page, variant.url), variant: variant.name, round };
      (round < 0 ? warmups : samples).push(sample);
      console.log(`${round < 0 ? "warmup" : `round ${round + 1}/${rounds}`} ${variant.name}: ${sample.taskMs.toFixed(2)} ms task, rAF p95 ${sample.rafP95Ms.toFixed(2)} ms`);
      await page.close();
    }
  }
  const summaries = Object.fromEntries(variants.map(({ name }) => [name, Object.fromEntries((["taskMs", "styleMs", "layoutMs", "rafP95Ms", "elapsedMs", "stalled", "retargets"] as const).map((metric) => [metric, spread(samples.filter((sample) => sample.variant === name).map((sample) => sample[metric]))]))]));
  await Bun.write(process.env.BENCH_OUTPUT ?? "perf/scrub.local.json", JSON.stringify({ benchmark: pointer ? "production-scrub-native-pointer-v2" : "production-scrub-v1", settings, artifact, variants, environment: { browser: browser.version(), bun: Bun.version, os: process.platform, release: release(), cpu: cpus()[0]?.model }, summaries, samples, warmups }, null, 2) + "\n");
  for (const [name, summary] of Object.entries(summaries)) console.log(`METRIC variant=${name} scrub_task_ms=${summary.taskMs!.median.toFixed(2)} raf_p95_ms=${summary.rafP95Ms!.median.toFixed(2)}`);
  completed = true;
} finally {
  await browser.close();
  await Promise.all(servers.map((server) => server.close()));
  if (!completed || process.env.BENCH_KEEP_BUILD !== "1") await rm(directory, { recursive: true, force: true });
}
