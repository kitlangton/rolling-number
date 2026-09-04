import { StrictMode, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { RollingNumber } from "../src/react";
import { Track } from "../src/track";
import { spring } from "../src/motion";
import "../src/styles.css";
import "./demo.css";

const repository = "https://github.com/kitlangton/rolling-number";
const currency: Intl.NumberFormatOptions = { style: "currency", currency: "USD", maximumFractionDigits: 0 };
const clock: Intl.NumberFormatOptions = { minimumIntegerDigits: 2, useGrouping: false };
const milliseconds: Intl.NumberFormatOptions = { style: "unit", unit: "millisecond", unitDisplay: "short", maximumFractionDigits: 0 };
const percent: Intl.NumberFormatOptions = { style: "percent", maximumFractionDigits: 0 };
const temperature: Intl.NumberFormatOptions = { style: "unit", unit: "celsius", signDisplay: "exceptZero", minimumFractionDigits: 1, maximumFractionDigits: 1 };
const currencies = ["USD", "EUR", "JPY", "GBP"];
const localeOptions = [["en-US", "English"], ["de-DE", "Deutsch"], ["fr-FR", "Français"], ["hi-IN", "Hindi"], ["ja-JP", "日本語"], ["ar-EG", "العربية"], ["fa-IR", "فارسی"]];

const Examples = memo(function Examples({ locale, duration, reduced, motionBlur }: { locale: string; duration: number; reduced: boolean; motionBlur: boolean }) {
  const [revenue, setRevenue] = useState({ value: 8240, animated: true });
  const [seconds, setSeconds] = useState({ value: 90, animated: true });
  const [running, setRunning] = useState(false);
  const [seats, setSeats] = useState({ value: 8, animated: true });
  const [large, setLarge] = useState({ value: 9007199254740993n, animated: true });
  const [progress, setProgress] = useState({ value: .64, animated: true });
  const [degrees, setDegrees] = useState({ value: -4.5, animated: true });
  const [currencyIndex, setCurrencyIndex] = useState({ value: 0, animated: true });
  const [growth, setGrowth] = useState({ value: 23, animated: true });
  const revenueNumber = useRef<HTMLDivElement>(null);
  const saleFlash = useRef<Animation | null>(null);
  function stopSaleFlash() {
    if (!saleFlash.current) return;
    saleFlash.current.onfinish = null;
    saleFlash.current.cancel();
    saleFlash.current = null;
  }
  function flashSale(animated: boolean) {
    stopSaleFlash();
    const element = revenueNumber.current;
    if (!animated || reduced || matchMedia("(prefers-reduced-motion: reduce)").matches || typeof element?.animate !== "function") return;
    const animation = element.animate([{ color: "#fff" }, { color: "var(--revenue-ink)" }], { duration: 1000, easing: "ease-out" });
    saleFlash.current = animation;
    animation.onfinish = () => { if (saleFlash.current === animation) stopSaleFlash(); };
  }
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (reduced || media.matches) stopSaleFlash(); };
    changed();
    media.addEventListener("change", changed);
    return () => { media.removeEventListener("change", changed); stopSaleFlash(); };
  }, [reduced]);
  const pointer = useRef(false);
  const priceNumber = useRef<HTMLDivElement>(null);
  const priceSuffix = useRef<HTMLSpanElement>(null);
  const priceAnimated = useRef(true);
  priceAnimated.current = seats.animated;
  useLayoutEffect(() => {
    if (!priceNumber.current || !priceSuffix.current || typeof ResizeObserver !== "function") return;
    const track = new Track(priceSuffix.current, "transform");
    const translate = (x: number) => `translateX(${x}px)`;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let previousWidth: number | undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect.width;
      const previous = previousWidth;
      previousWidth = width;
      if (previous === undefined || previous === width) return;
      if (reduced || media.matches || !priceAnimated.current) { track.set(0, translate); return; }
      const current = track.read();
      track.play(spring(current.position + previous - width, 0, current.velocity, duration), translate);
    });
    const preference = () => { if (media.matches) track.set(0, translate); };
    observer.observe(priceNumber.current);
    media.addEventListener("change", preference);
    return () => { observer.disconnect(); track.cancel(); media.removeEventListener("change", preference); };
  }, [duration, reduced]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((current) => ({ value: Math.max(0, current.value - 1), animated: true })), 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => { if (seconds.value === 0) setRunning(false); }, [seconds.value]);
  const shared = { locales: locale, duration, motionBlur };
  return (
    <section id="examples" className="examples" aria-label="Examples">
      <article className="example">
        <h2>Revenue</h2>
        <div ref={revenueNumber} className="example-number revenue-number"><RollingNumber {...shared} value={revenue.value} format={currency} animated={!reduced && revenue.animated} /></div>
        <button className="quiet" onClick={(event) => { flashSale(event.detail > 0); setRevenue((current) => ({ value: current.value + 125, animated: event.detail > 0 })); }}>Add a sale <span>+125</span></button>
      </article>
      <article className="example">
        <h2>Timer</h2>
        <div className="example-number timer" role="timer" aria-live="off">
          <span className="sr-only">{seconds.value} seconds remaining</span>
          <span aria-hidden="true"><RollingNumber {...shared} value={Math.floor(seconds.value / 60)} format={clock} animated={!reduced && seconds.animated} /><span className="colon">:</span><RollingNumber {...shared} value={seconds.value % 60} format={clock} animated={!reduced && seconds.animated} /></span>
        </div>
        <div className="example-actions">
          <button className="quiet" disabled={seconds.value === 0} onClick={() => setRunning((current) => !current)}>{running ? "Pause timer" : "Start timer"}</button>
          <button className="quiet muted" onClick={(event) => { setRunning(false); setSeconds({ value: 90, animated: event.detail > 0 }); }}>Reset</button>
        </div>
      </article>
      <article className="example">
        <h2>Pricing</h2>
        <div className="price"><div ref={priceNumber} className="example-number"><RollingNumber {...shared} value={seats.value * 12} format={currency} animated={!reduced && seats.animated} /></div><span ref={priceSuffix}>/ month</span></div>
        <div className="seat-control">
          <label htmlFor="seats">Seats <output>{seats.value}</output></label>
          <input id="seats" type="range" min="1" max="24" value={seats.value}
            onPointerDown={() => { pointer.current = true; }} onPointerUp={() => { pointer.current = false; }} onPointerCancel={() => { pointer.current = false; }} onBlur={() => { pointer.current = false; }} onKeyDown={() => { pointer.current = false; }}
            onChange={(event) => setSeats({ value: Number(event.target.value), animated: pointer.current })} />
        </div>
      </article>
      <article className="example example-bigint">
        <h2>BigInt</h2>
        <div className="example-number bigint-number"><RollingNumber {...shared} value={large.value} animated={!reduced && large.animated} /></div>
        <div className="example-actions">
          <button className="quiet" onClick={(event) => setLarge((current) => ({ value: current.value - 1n, animated: event.detail > 0 }))}>Subtract 1</button>
          <button className="quiet" onClick={(event) => setLarge((current) => ({ value: current.value + 1n, animated: event.detail > 0 }))}>Add 1</button>
        </div>
      </article>
      <article className="example">
        <h2>Progress</h2>
        <div className="example-number"><RollingNumber {...shared} value={progress.value} format={percent} animated={!reduced && progress.animated} /></div>
        <div className="example-actions">
          <button className="quiet" disabled={progress.value >= 1} onClick={(event) => setProgress((current) => ({ value: Math.min(1, current.value + .1), animated: event.detail > 0 }))}>Add 10%</button>
          <button className="quiet muted" onClick={(event) => setProgress({ value: 0, animated: event.detail > 0 })}>Reset progress</button>
        </div>
      </article>
      <article className="example">
        <h2>Temperature</h2>
        <div className="example-number"><RollingNumber {...shared} value={degrees.value} format={temperature} animated={!reduced && degrees.animated} /></div>
        <div className="example-actions">
          <button className="quiet" onClick={(event) => setDegrees((current) => ({ value: current.value - 5, animated: event.detail > 0 }))}>Cool down</button>
          <button className="quiet" onClick={(event) => setDegrees((current) => ({ value: current.value + 5, animated: event.detail > 0 }))}>Warm up</button>
        </div>
      </article>
      <article className="example">
        <h2>Currency</h2>
        <div className="example-number"><RollingNumber {...shared} value={1987.65} format={{ style: "currency", currency: currencies[currencyIndex.value]! }} animated={!reduced && currencyIndex.animated} /></div>
        <button className="quiet" onClick={(event) => setCurrencyIndex((current) => ({ value: (current.value + 1) % currencies.length, animated: event.detail > 0 }))}>Change currency</button>
      </article>
      <article className="example">
        <h2>Digit growth</h2>
        <div className="example-number"><RollingNumber {...shared} value={growth.value} animated={!reduced && growth.animated} /></div>
        <button className="quiet" onClick={(event) => setGrowth((current) => ({ value: current.value === 23 ? 5823823 : 23, animated: event.detail > 0 }))}>{growth.value === 23 ? "Grow" : "Shrink"}</button>
      </article>
    </section>
  );
});

function App() {
  const [elapsed, setElapsed] = useState(0);
  const [locale, setLocale] = useState("en-US");
  const [duration, setDuration] = useState(500);
  const [reduced, setReduced] = useState(false);
  const [motionBlur, setMotionBlur] = useState(true);
  const [tabular, setTabular] = useState(true);
  const [font, setFont] = useState("sans");
  const [size, setSize] = useState(144);
  const [direction, setDirection] = useState<"auto" | "up" | "down">("auto");
  const staticLocale = locale === "ar-EG" || locale === "fa-IR";
  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      if (document.hidden) return;
      setElapsed(Math.floor(performance.now() - start));
    };
    const timer = setInterval(tick, 33);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return (
    <div className="site-shell">
      <a className="skip-link" href="#playground">Skip to showcase</a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Rolling Number home"><h1>rolling number</h1></a>
        <nav aria-label="Main navigation"><a href={`${repository}#readme`}>Docs</a><a href={repository}>GitHub <span aria-hidden="true">↗</span></a></nav>
      </header>
      <main>
        <section className="playground" id="playground" aria-label="Interactive number playground">
          <div className={`number-stage font-${font} ${tabular ? "digits-tabular" : "digits-proportional"}`} style={{ "--number-scale": size / 144 } as CSSProperties}>
            <div className="number-frame" role="timer" aria-live="off"><span className="sr-only">Time on this page: </span><RollingNumber value={elapsed} locales={locale} format={milliseconds} duration={duration} animated={!reduced} motionBlur={motionBlur} direction={direction} /></div>
          </div>
          <details className="settings-panel">
            <summary>Options</summary>
            <div className="settings">
              <label>Locale<select id="locale" value={locale} onChange={(event) => setLocale(event.target.value)}>{localeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Typeface<select id="typeface" value={font} onChange={(event) => setFont(event.target.value)}><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select></label>
              <label>Duration<select id="duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value="200">200 ms</option><option value="500">500 ms</option><option value="1000">1000 ms</option></select></label>
              <label>Direction<select id="direction" value={direction} onChange={(event) => { const value = event.target.value; if (value === "auto" || value === "up" || value === "down") setDirection(value); }}><option value="auto">Auto</option><option value="up">Up</option><option value="down">Down</option></select></label>
              <label className="size-control">Size <output>{Math.round(size / 144 * 100)}%</output><input id="font-size" type="range" min="72" max="176" step="8" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
              <div className="toggles"><label><input type="checkbox" checked={tabular} onChange={(event) => setTabular(event.target.checked)} />Tabular digits</label><label><input type="checkbox" checked={motionBlur} onChange={(event) => setMotionBlur(event.target.checked)} />Motion blur</label><label><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />Reduce motion</label></div>
            </div>
          </details>
          {staticLocale && <p className="locale-note">This locale uses native text without rolling.</p>}
        </section>
        <Examples locale={locale} duration={duration} reduced={reduced} motionBlur={motionBlur} />
      </main>
      <footer className="site-footer"><code>{"<RollingNumber value={value} />"}</code><a href="./bench.html">Benchmarks</a><a href={`${repository}/blob/main/LICENSE`}>MIT</a></footer>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
