import { StrictMode, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { RollingNumber } from "../src/react";
import { Track } from "../src/track";
import { spring } from "../src/motion";
import { ActivityGraphic, AvatarGraphic, FileGraphic, LedgerGraphic, ShirtGraphic, WeatherGraphic } from "./MiniGraphics";
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
    const animation = element.animate([{ color: "#fff" }, { color: "var(--revenue-ink)" }], { duration: 1800, easing: "ease-out" });
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
    <section id="examples" className="examples" aria-label="Examples" data-reduced={reduced}>
      <article className="example mini-app shop-app">
        <h2>Shop</h2>
        <div className="shop-product">
          <div className="product-art"><ShirtGraphic /></div>
          <div className="product-info"><strong>Studio tee</strong><span>Washed black · $125</span><button className="mini-button" aria-label="Buy Studio tee" onClick={(event) => { flashSale(event.detail > 0); setRevenue((current) => ({ value: current.value + 125, animated: event.detail > 0 })); }}>Buy <span aria-hidden="true">↗</span></button></div>
        </div>
        <div className="app-metric"><span className="mini-label">Revenue</span><div ref={revenueNumber} className="example-number revenue-number"><RollingNumber {...shared} value={revenue.value} format={currency} animated={!reduced && revenue.animated} /></div></div>
      </article>
      <article className="example mini-app focus-app">
        <h2>Focus</h2>
        <div className="focus-dial">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="53" fill="none" stroke="#282d34" strokeWidth="2" /><circle className="dial-progress" cx="60" cy="60" r="53" fill="none" stroke="#a6b1bf" strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - seconds.value / 90} transform="rotate(-90 60 60)" /></svg>
          <div className="example-number timer" role="timer" aria-live="off"><span className="sr-only">{seconds.value} seconds remaining</span><span aria-hidden="true"><RollingNumber {...shared} value={Math.floor(seconds.value / 60)} format={clock} animated={!reduced && seconds.animated} /><span className="colon">:</span><RollingNumber {...shared} value={seconds.value % 60} format={clock} animated={!reduced && seconds.animated} /></span></div>
        </div>
        <div className="example-actions centered"><button className="mini-button" aria-label={running ? "Pause timer" : "Start timer"} disabled={seconds.value === 0} onClick={() => setRunning((current) => !current)}>{running ? "Pause" : "Start"}</button><button className="quiet muted" aria-label="Reset timer" onClick={(event) => { setRunning(false); setSeconds({ value: 90, animated: event.detail > 0 }); }}>Reset</button></div>
      </article>
      <article className="example mini-app team-app">
        <h2>Team plan</h2>
        <div className="avatar-stack" aria-hidden="true">{Array.from({ length: Math.min(seats.value, 5) }, (_, index) => <span className="mini-avatar" key={index}><AvatarGraphic /></span>)}{seats.value > 5 && <span className="extra-members">+{seats.value - 5}</span>}</div>
        <div className="price"><div ref={priceNumber} className="example-number"><RollingNumber {...shared} value={seats.value * 12} format={currency} animated={!reduced && seats.animated} /></div><span ref={priceSuffix}>/ month</span></div>
        <div className="seat-control">
          <label htmlFor="seats">Seats <output>{seats.value}</output></label>
          <input id="seats" type="range" min="1" max="24" value={seats.value}
            onPointerDown={() => { pointer.current = true; }} onPointerUp={() => { pointer.current = false; }} onPointerCancel={() => { pointer.current = false; }} onBlur={() => { pointer.current = false; }} onKeyDown={() => { pointer.current = false; }}
            onChange={(event) => setSeats({ value: Number(event.target.value), animated: pointer.current })} />
        </div>
      </article>
      <article className="example mini-app example-bigint">
        <h2>Event stream</h2>
        <LedgerGraphic />
        <div className="app-metric"><span className="mini-label">Event ID · BigInt</span><div className="example-number bigint-number"><RollingNumber {...shared} value={large.value} animated={!reduced && large.animated} /></div></div>
        <div className="example-actions">
          <button className="quiet" aria-label="Previous event" onClick={(event) => setLarge((current) => ({ value: current.value - 1n, animated: event.detail > 0 }))}>← Previous</button>
          <button className="quiet" aria-label="Next event" onClick={(event) => setLarge((current) => ({ value: current.value + 1n, animated: event.detail > 0 }))}>Next →</button>
        </div>
      </article>
      <article className="example mini-app upload-app">
        <h2>Upload</h2>
        <div className="upload-file"><FileGraphic video /><div><strong>demo.mov</strong><span className="mini-label">24 MB</span></div><div className="example-number"><RollingNumber {...shared} value={progress.value} format={percent} animated={!reduced && progress.animated} /></div></div>
        <div className="upload-track" aria-hidden="true"><span style={{ transform: `scaleX(${progress.value})`, transition: progress.animated ? undefined : "none" }} /></div>
        <div className="example-actions">
          <button className="mini-button" disabled={progress.value >= 1} onClick={(event) => setProgress((current) => ({ value: Math.min(1, current.value + .1), animated: event.detail > 0 }))}>{progress.value >= 1 ? "Uploaded" : "Upload chunk"}</button>
          <button className="quiet muted" aria-label="Restart upload" onClick={(event) => setProgress({ value: 0, animated: event.detail > 0 })}>Restart</button>
        </div>
      </article>
      <article className="example mini-app weather-app">
        <h2>Weather</h2>
        <div className="weather-summary"><div><span className="mini-label">Reykjavík</span><div className="example-number"><RollingNumber {...shared} value={degrees.value} format={temperature} animated={!reduced && degrees.animated} /></div></div><WeatherGraphic /></div>
        <div className="weather-controls"><span className="mini-label">Adjust temperature</span><div className="example-actions">
          <button className="mini-button square" aria-label="Cool down" onClick={(event) => setDegrees((current) => ({ value: current.value - 5, animated: event.detail > 0 }))}>−</button>
          <button className="mini-button square" aria-label="Warm up" onClick={(event) => setDegrees((current) => ({ value: current.value + 5, animated: event.detail > 0 }))}>+</button>
        </div></div>
      </article>
      <article className="example mini-app invoice-app">
        <h2>Invoice</h2>
        <div className="invoice-body"><FileGraphic /><div><strong>INV–0042</strong><span className="mini-label">Design services</span></div></div>
        <div className="invoice-total"><span className="mini-label">Total</span><div className="example-number"><RollingNumber {...shared} value={1987.65} format={{ style: "currency", currency: currencies[currencyIndex.value]! }} animated={!reduced && currencyIndex.animated} /></div></div>
        <div className="currency-switch" role="group" aria-label="Invoice currency">{currencies.map((code, index) => <button key={code} aria-pressed={currencyIndex.value === index} onClick={(event) => setCurrencyIndex({ value: index, animated: event.detail > 0 })}>{code}</button>)}</div>
      </article>
      <article className="example mini-app audience-app">
        <h2>Audience</h2>
        <div className="app-metric"><span className="mini-label">Followers</span><div className="example-number"><RollingNumber {...shared} value={growth.value} animated={!reduced && growth.animated} /></div></div>
        <ActivityGraphic active={growth.value > 23} animated={growth.animated} />
        <div className="example-actions">
          <button className="mini-button" onClick={(event) => setGrowth((current) => ({ value: current.value === 23 ? 5823823 : 23, animated: event.detail > 0 }))}>{growth.value === 23 ? "Go viral" : "Reset audience"}</button>
        </div>
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
