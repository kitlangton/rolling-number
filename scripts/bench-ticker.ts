import { chromium } from "playwright";
import { cpus } from "node:os";
import type {} from "../demo/test";

// Run `bun run dev --port 4173 --strictPort` first. This compares the local DOM core,
// not framework overhead or another library. Keep other browser workloads idle.
const compareBlur = process.env.BENCH_BLUR === "compare";
const fontSize = Number(process.env.BENCH_FONT_SIZE ?? 144);
if (!Number.isFinite(fontSize) || fontSize <= 0) throw new Error("BENCH_FONT_SIZE must be positive");
const browser = await chromium.launch();
const samples: { motionBlur: boolean; taskMs: number; layoutReads: number; elapsedMs: number; activeElements: number; settledElements: number }[] = [];
try {
  for (let round = 0; round < 8; round++) {
    const modes = compareBlur ? (round % 2 ? [true, false] : [false, true]) : [false];
    for (const motionBlur of modes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto("http://127.0.0.1:4173/test.html");
    await page.waitForFunction(() => window.ready);
    await page.evaluate(async ({ motionBlur, fontSize }) => {
      window.mountNumber({ value: 11111, locales: "en-US", duration: 500, motionBlur, format: { minimumIntegerDigits: 5, maximumFractionDigits: 0, useGrouping: false } });
      document.getElementById("number")!.style.font = `${fontSize}px/1.2 monospace`;
      for (let digit = 0; digit < 10; digit++) {
        window.testNumber.update({ value: digit * 11111 });
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      }
    }, { motionBlur, fontSize });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const before = await cdp.send("Performance.getMetrics");
    const observed = await page.evaluate(async () => {
      let layoutReads = 0;
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () { layoutReads++; return original.call(this); };
      const start = performance.now();
      try {
        await new Promise<void>((resolve) => {
          let step = 0;
          const timer = setInterval(() => {
            window.testNumber.update({ value: 54321 + ++step * 33 });
            if (step === 90) { clearInterval(timer); resolve(); }
          }, 33);
        });
        await new Promise(requestAnimationFrame);
        const activeElements = document.querySelectorAll("#number *").length;
        await new Promise((resolve) => setTimeout(resolve, 650));
        return { layoutReads, elapsedMs: performance.now() - start, activeElements, settledElements: document.querySelectorAll("#number *").length };
      } finally { Element.prototype.getBoundingClientRect = original; }
    });
    const after = await cdp.send("Performance.getMetrics");
    const task = (metrics: typeof before) => metrics.metrics.find((metric) => metric.name === "TaskDuration")!.value;
    const result = { motionBlur, taskMs: (task(after) - task(before)) * 1000, ...observed };
    if (round) samples.push(result);
    console.log(`${round ? `round ${round}` : "warmup"} blur=${motionBlur}: ${result.taskMs.toFixed(2)} ms task, ${result.layoutReads} layout reads`);
    await page.close();
    }
  }
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  const source = new Bun.CryptoHasher("sha256");
  for (const path of [...new Bun.Glob("src/*").scanSync()].sort()) { source.update(`${path}\0`); source.update(await Bun.file(path).arrayBuffer()); }
  const result = {
    benchmark: "steady five-digit ticker", sourceTreeSha256: source.digest("hex"),
    workload: { counters: 1, updates: 90, intervalMs: 33, settleMs: 650, font: `${fontSize}px/1.2 monospace`, mode: "Vite development server", warmups: 1, rounds: 7, alternateBlurOrder: compareBlur },
    environment: { browser: await browser.version(), bun: Bun.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model },
    summaries: (compareBlur ? [false, true] : [false]).map((motionBlur) => {
      const group = samples.filter((sample) => sample.motionBlur === motionBlur);
      return { motionBlur, medianTaskMs: median(group.map((sample) => sample.taskMs)), minTaskMs: Math.min(...group.map((sample) => sample.taskMs)), maxTaskMs: Math.max(...group.map((sample) => sample.taskMs)), medianLayoutReads: median(group.map((sample) => sample.layoutReads)), medianActiveElements: median(group.map((sample) => sample.activeElements)), medianSettledElements: median(group.map((sample) => sample.settledElements)) };
    }), samples,
  };
  await Bun.write(process.env.BENCH_OUTPUT ?? "perf/ticker.local.json", `${JSON.stringify(result, null, 2)}\n`);
  for (const summary of result.summaries) console.log(`METRIC blur=${summary.motionBlur} ticker_task_ms=${summary.medianTaskMs.toFixed(2)} layout_reads=${summary.medianLayoutReads}`);
} finally { await browser.close(); }
