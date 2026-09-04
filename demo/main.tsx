import { StrictMode, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { RollingNumber } from "../src/react";
import { Eyes } from "./Eyes";
import "../src/styles.css";
import "./demo.css";

const repository = "https://github.com/kitlangton/rolling-number";
const decimal: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const currency: Intl.NumberFormatOptions = { style: "currency", currency: "USD", maximumFractionDigits: 0 };
const clock: Intl.NumberFormatOptions = { minimumIntegerDigits: 2, useGrouping: false };
const localeOptions = [["en-US", "English"], ["de-DE", "Deutsch"], ["fr-FR", "Français"], ["hi-IN", "Hindi"], ["ja-JP", "日本語"], ["ar-EG", "العربية"], ["fa-IR", "فارسی"]];

function Examples({ locale, duration, reduced }: { locale: string; duration: number; reduced: boolean }) {
  const [revenue, setRevenue] = useState({ value: 8240, animated: true });
  const [seconds, setSeconds] = useState({ value: 90, animated: true });
  const [running, setRunning] = useState(false);
  const [seats, setSeats] = useState({ value: 8, animated: true });
  const [large, setLarge] = useState({ value: 9007199254740993n, animated: true });
  const pointer = useRef(false);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((current) => ({ value: Math.max(0, current.value - 1), animated: true })), 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => { if (seconds.value === 0) setRunning(false); }, [seconds.value]);
  const shared = { locales: locale, duration };
  return (
    <section id="examples" className="examples" aria-label="Examples">
      <article className="example">
        <h2>Revenue</h2>
        <div className="example-number"><RollingNumber {...shared} value={revenue.value} format={currency} animated={!reduced && revenue.animated} /></div>
        <button className="quiet" onClick={(event) => setRevenue((current) => ({ value: current.value + 125, animated: event.detail > 0 }))}>Add a sale <span>+125</span></button>
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
        <div className="price"><div className="example-number"><RollingNumber {...shared} value={seats.value * 12} format={currency} animated={!reduced && seats.animated} /></div><span>/ month</span></div>
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
    </section>
  );
}

function App() {
  const [hero, setHero] = useState({ value: 1284.5, animated: true });
  const [input, setInput] = useState("1284.50");
  const [locale, setLocale] = useState("en-US");
  const [duration, setDuration] = useState(500);
  const [reduced, setReduced] = useState(false);
  const [tabular, setTabular] = useState(true);
  const [font, setFont] = useState("sans");
  const [size, setSize] = useState(144);
  const [direction, setDirection] = useState<"auto" | "up" | "down">("auto");
  const [stressing, setStressing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentValue = useRef(1284.5);
  const previousValue = useRef(9876.54);
  const staticLocale = locale === "ar-EG" || locale === "fa-IR";
  useEffect(() => () => { if (timer.current !== null) clearInterval(timer.current); }, []);
  function stopStress() {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    setStressing(false);
  }
  function changeValue(value: number, animated: boolean) {
    if (!Number.isFinite(value)) return;
    previousValue.current = currentValue.current;
    currentValue.current = value;
    setHero({ value, animated });
    setInput(value.toFixed(2));
  }
  function adjust(event: MouseEvent<HTMLButtonElement>, amount: number) {
    stopStress();
    changeValue(currentValue.current + amount, event.detail > 0);
  }
  function stress(event: MouseEvent<HTMLButtonElement>) {
    if (stressing) { stopStress(); return; }
    const animate = event.detail > 0;
    const sequence = [9999.99, 10.01, 8765.43, 123.45, 999.99, 1000, 99.99, 100, -123.45, 0, 6789.12, 1284.5];
    let index = 0;
    setStressing(true);
    changeValue(sequence[index++] ?? 0, animate);
    timer.current = setInterval(() => {
      const value = sequence[index++];
      if (value === undefined) stopStress();
      else changeValue(value, animate);
    }, 90);
  }
  return (
    <div className="site-shell">
      <a className="skip-link" href="#playground">Skip to showcase</a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Rolling Number home"><Eyes reduced={reduced} /><h1>rolling number</h1></a>
        <nav aria-label="Main navigation"><a href={`${repository}#readme`}>Docs</a><a href={repository}>GitHub <span aria-hidden="true">↗</span></a></nav>
      </header>
      <main>
        <section className="playground" id="playground" aria-label="Interactive number playground">
          <div className={`number-stage font-${font} ${tabular ? "digits-tabular" : "digits-proportional"}`} style={{ "--number-scale": size / 144 } as CSSProperties}>
            <div className="number-frame"><RollingNumber value={hero.value} locales={locale} format={decimal} duration={duration} animated={!reduced && hero.animated} direction={direction} /></div>
          </div>
          <div className="play-actions">
            <div className="value-control">
              <button className="icon-button" aria-label="Subtract one hundred" onClick={(event) => adjust(event, -100)}>−</button>
              <label className="sr-only" htmlFor="number-value">Number value</label>
              <input id="number-value" type="number" step="0.01" value={input} onChange={(event) => {
                stopStress(); setInput(event.target.value);
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value)) { previousValue.current = currentValue.current; currentValue.current = value; setHero({ value, animated: false }); }
              }} onBlur={() => setInput(currentValue.current.toFixed(2))} />
              <button className="icon-button" aria-label="Add one hundred" onClick={(event) => adjust(event, 100)}>+</button>
            </div>
            <div className="button-row">
              <button className="primary" onClick={(event) => { stopStress(); const next = Math.round(Math.random() * 999999) / 100; changeValue(next === currentValue.current ? next + 1 : next, event.detail > 0); }}>Shuffle</button>
              <button onClick={(event) => { stopStress(); changeValue(previousValue.current, event.detail > 0); }}>Reverse</button>
              <button aria-pressed={stressing} onClick={stress}>{stressing ? "Stop" : "Stress test"}</button>
            </div>
          </div>
          <details className="settings-panel">
            <summary>Options</summary>
            <div className="settings">
              <label>Locale<select id="locale" value={locale} onChange={(event) => { stopStress(); setLocale(event.target.value); setHero((value) => ({ ...value, animated: false })); }}>{localeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Typeface<select id="typeface" value={font} onChange={(event) => setFont(event.target.value)}><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select></label>
              <label>Duration<select id="duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value="200">200 ms</option><option value="500">500 ms</option><option value="1000">1000 ms</option></select></label>
              <label>Direction<select id="direction" value={direction} onChange={(event) => { const value = event.target.value; if (value === "auto" || value === "up" || value === "down") setDirection(value); }}><option value="auto">Auto</option><option value="up">Up</option><option value="down">Down</option></select></label>
              <label className="size-control">Size <output>{Math.round(size / 144 * 100)}%</output><input id="font-size" type="range" min="72" max="176" step="8" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
              <div className="toggles"><label><input type="checkbox" checked={tabular} onChange={(event) => setTabular(event.target.checked)} />Tabular digits</label><label><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />Reduce motion</label></div>
            </div>
          </details>
          {staticLocale && <p className="locale-note">This locale uses native text without rolling.</p>}
        </section>
        <Examples locale={locale} duration={duration} reduced={reduced} />
      </main>
      <footer className="site-footer"><code>{"<RollingNumber value={value} />"}</code><a href="./bench.html">Benchmarks</a><a href={`${repository}/blob/main/LICENSE`}>MIT</a></footer>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
