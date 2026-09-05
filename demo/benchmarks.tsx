import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import NumberFlow, { useCanAnimate } from "@number-flow/react";
import AnimatedNumbersImport from "react-animated-numbers";
import CountUpImport from "react-countup";
import { RollingNumber } from "../src/react";
import "../src/styles.css";
import "./demo.css";
import "./benchmarks.css";

// These two packages publish CommonJS defaults; Vite's dev/production interop differs.
function unwrap<T>(value: T | { default: T }): T {
  return typeof value === "object" && value !== null && "default" in value ? value.default : value as T;
}
const AnimatedNumbers = unwrap(AnimatedNumbersImport);
const CountUp = unwrap(CountUpImport);

const libraries = {
  rolling: { name: "Rolling Number", version: `source ${String(import.meta.env.BENCH_SOURCE).slice(0, 8)}`, behavior: "Per-place rolling; replacement springs", url: "https://github.com/kitlangton/rolling-number" },
  numberflow: { name: "NumberFlow React", version: "0.6.2", behavior: "Per-place rolling; composed transitions", url: "https://number-flow.barvian.me/" },
  animated: { name: "React Animated Numbers", version: "1.1.1", behavior: "Digit reels driven by Motion", url: "https://github.com/heyman333/react-animated-numbers" },
  countup: { name: "React CountUp", version: "6.5.3", behavior: "Numeric interpolation, not rolling glyphs", url: "https://github.com/glennreyes/react-countup" },
} as const;
type Kind = keyof typeof libraries;
interface Sample { kind: Kind; elapsed: number; rafP95: number; elements: number; updates: number }
const sequence = [999, 1000, 999, 1001, 998, 1000, 1001, 999];
const duration = 500;
const easing = `linear(${Array.from({ length: 49 }, (_, i) => i === 48 ? 1 : 1 - (1 + 10 * i / 48) * Math.exp(-10 * i / 48)).join(",")})`;
const format = { maximumFractionDigits: 0 };
const font = { fontSize: 20, fontFamily: "Arial, sans-serif", fontVariantNumeric: "tabular-nums" };

function Counter({ kind, value }: { kind: Kind; value: number }) {
  if (kind === "numberflow") return <NumberFlow value={value} locales="en-US" format={format} transformTiming={{ duration, easing }} spinTiming={{ duration, easing }} opacityTiming={{ duration, easing: "ease-out" }} />;
  if (kind === "animated") return <AnimatedNumbers animateToNumber={value} useThousandsSeparator locale="en-US" fontStyle={font} transitions={() => ({ type: "tween", duration: duration / 1000, ease: "easeOut" })} />;
  if (kind === "countup") return <CountUp end={value} duration={duration / 1000} separator="," preserveValue />;
  return <RollingNumber value={value} locales="en-US" format={format} duration={duration} pauseOffscreen={false} motionBlur={false} />;
}
function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  return sorted[low]! + (sorted[Math.ceil(index)]! - sorted[low]!) * (index - low);
}
function elementCount(root: Element | ShadowRoot): number {
  return [...root.children].reduce((sum, child) => sum + 1 + elementCount(child) + (child.shadowRoot ? elementCount(child.shadowRoot) : 0), 0);
}
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(new Error("Run canceled")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  });
}

async function sample(stage: HTMLElement, kind: Kind, count: number, signal: AbortSignal): Promise<Sample> {
  let failure: unknown;
  const root = createRoot(stage, { onUncaughtError: (error) => { failure = error; } });
  let frame = 0;
  const intervals: number[] = [];
  let previous = 0;
  const verify = () => {
    if (failure) throw failure;
    if (stage.children.length !== count) throw new Error(`${libraries[kind].name} did not render all counters`);
  };
  const render = (value: number) => {
    flushSync(() => root.render(<>{Array.from({ length: count }, (_, i) => <div className="compare-cell" key={i}><Counter kind={kind} value={value} /></div>)}</>));
    verify();
  };
  try {
    render(998);
    stage.scrollIntoView({ block: "center", behavior: "instant" });
    const bounds = stage.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > innerHeight) throw new Error("Choose fewer counters so the entire grid is visible; libraries have different offscreen policies");
    await wait(800, signal); // Include visibility-triggered mount effects, outside measurement.
    verify();
    const start = performance.now();
    const tick = (now: number) => { if (previous) intervals.push(now - previous); previous = now; frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    for (const [index, value] of sequence.entries()) {
      await wait(Math.max(0, start + index * (1000 / 6) - performance.now()), signal);
      render(value);
    }
    await wait(duration + 200, signal);
    verify();
    cancelAnimationFrame(frame);
    if (document.hidden || intervals.length < 2) throw new Error("The page must remain visible throughout the run");
    return { kind, elapsed: performance.now() - start, rafP95: percentile(intervals, .95), elements: elementCount(stage), updates: sequence.length };
  } finally { cancelAnimationFrame(frame); root.unmount(); }
}

function Benchmarks() {
  const numberFlowCanAnimate = useCanAnimate();
  const stage = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | undefined>(undefined);
  const environment = useRef({ userAgent: navigator.userAgent, dpr: devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, numberFlowCanAnimate });
  const [selected, setSelected] = useState<Kind | "all">("all");
  const [count, setCount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready. Keep this tab visible and other workloads idle.");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [reduced, setReduced] = useState(matchMedia("(prefers-reduced-motion: reduce)").matches);
  const unsupported = !numberFlowCanAnimate && (selected === "all" || selected === "numberflow");
  function download() {
    const data = { benchmark: "react-carry-reversal-v1", sourceSha256: import.meta.env.BENCH_SOURCE, production: import.meta.env.PROD, libraries, count, sequence, duration, hz: 6, rounds: 7, ...environment.current, samples };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "rolling-number-react-benchmark.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const hide = () => { if (document.hidden) controller.current?.abort(); };
    const resize = () => controller.current?.abort();
    const preference = () => { setReduced(media.matches); if (media.matches) controller.current?.abort(); };
    media.addEventListener("change", preference); document.addEventListener("visibilitychange", hide); window.addEventListener("resize", resize);
    return () => { controller.current?.abort(); media.removeEventListener("change", preference); document.removeEventListener("visibilitychange", hide); window.removeEventListener("resize", resize); };
  }, []);
  async function run() {
    if (busy || reduced || unsupported || document.hidden) return;
    const abort = new AbortController(); controller.current = abort;
    environment.current = { userAgent: navigator.userAgent, dpr: devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, numberFlowCanAnimate };
    setBusy(true); setSamples([]);
    const kinds = selected === "all" ? Object.keys(libraries) as Kind[] : [selected];
    try {
      await document.fonts.ready;
      for (let round = -1; round < 7; round++) {
        const offset = Math.floor(Math.max(0, round) / 2) % kinds.length;
        const order = [...kinds.slice(offset), ...kinds.slice(0, offset)];
        if (round % 2) order.reverse();
        for (const kind of order) {
          setStatus(`${round < 0 ? "Warmup" : `Round ${round + 1}/7`} · ${libraries[kind].name}`);
          const result = await sample(stage.current!, kind, count, abort.signal);
          if (round >= 0) setSamples((current) => [...current, result]);
        }
      }
      setStatus("Complete. Inspect the visual behavior too—these are not identical animations.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Run failed"); }
    finally { setBusy(false); controller.current = undefined; }
  }
  return <div className="site-shell compare-shell">
    <header className="site-header"><a className="brand" href="./"><h1>rolling number</h1></a><span className="muted">unlisted · benchmark lab</span></header>
    <main>
      <h2>Same inputs. Different engines.</h2>
      <p className="compare-note">A React-only comparison, separate from the CLI's DOM benchmark. No blur. Positive integers, en-US grouping, 500 ms requested transitions, eight carry/reversal updates at 6 Hz. One discarded warmup and seven measured rounds per library.</p>
      <div className="compare-controls">
        <label>Library<select aria-label="Library" value={selected} disabled={busy} onChange={(e) => { setSelected(e.target.value as Kind | "all"); setSamples([]); }}><option value="all">All four, sequentially</option>{Object.entries(libraries).map(([key, lib]) => <option key={key} value={key}>{lib.name} {lib.version}</option>)}</select></label>
        <label>Counters<select aria-label="Counters" value={count} disabled={busy} onChange={(e) => { setCount(Number(e.target.value)); setSamples([]); }}>{[10, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></label>
        <button onClick={() => void run()} disabled={busy || reduced || unsupported}>Run comparison</button>
        <button onClick={() => controller.current?.abort()} disabled={!busy}>Stop</button>
        <button onClick={download} disabled={busy || !samples.length}>Export JSON</button>
      </div>
      <p role="status" className="compare-status">{reduced ? "Benchmark motion is disabled by your reduced-motion preference." : unsupported ? "NumberFlow animation is unavailable in this browser. Select another renderer or use a supported browser." : status}</p>
      <div className="compare-grid" ref={stage} aria-hidden="true" />
      <h3>This session's measurements</h3>
      <p className="compare-note">rAF p95 is callback spacing, <strong>not FPS</strong>. Elapsed time includes scheduling and settlement, not CPU time. DOM counts include open shadow roots. This page does not verify pixel equality; inspect each renderer's final value. Different travel, easing, and retargeting behavior limit comparisons.</p>
      <div className="compare-table"><table><thead><tr><th>Library</th><th>Runs</th><th>Elapsed median</th><th>rAF p95 median</th><th>Elements</th></tr></thead><tbody>{Object.entries(libraries).map(([key, lib]) => {
        const runs = samples.filter((s) => s.kind === key);
        return <tr key={key}><td><a href={lib.url}>{lib.name}</a><small>{lib.version} · {lib.behavior}</small></td><td>{runs.length}</td><td>{runs.length ? <>{percentile(runs.map((s) => s.elapsed), .5).toFixed(0)} ms<small>IQR {percentile(runs.map((s) => s.elapsed), .25).toFixed(0)}–{percentile(runs.map((s) => s.elapsed), .75).toFixed(0)}</small></> : "—"}</td><td>{runs.length ? `${percentile(runs.map((s) => s.rafP95), .5).toFixed(1)} ms` : "—"}</td><td>{runs.length ? percentile(runs.map((s) => s.elements), .5) : "—"}</td></tr>;
      })}</tbody></table></div>
      <p className="compare-note">React CountUp interpolates the numeric value; it does not animate individual glyphs. It is a different visual treatment, not a drop-in rolling competitor. All comparison packages are MIT-licensed development dependencies and are excluded from the published library.</p>
      <details><summary>Environment and reproducibility</summary><p className="compare-note">{navigator.userAgent}<br />DPR {devicePixelRatio} · {import.meta.env.PROD ? "Production build" : "Development build—do not publish timings"} · {count} counters · Arial 20px · React 19.2.8<br />Source SHA-256: {import.meta.env.BENCH_SOURCE}</p><p className="compare-note">For renderer main-thread task time, run <code>bun run bench</code>. That test compares the DOM core against NumberFlow 0.6.2, not these React adapters. Use <code>BENCH_OUTPUT</code> to preserve separate runs.</p></details>
    </main>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Benchmarks />);
