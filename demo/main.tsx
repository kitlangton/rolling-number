import { StrictMode, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RollingNumber } from "../src/react";
import "../src/styles.css";
import "./demo.css";

const repository = "https://github.com/kitlangton/rolling-number";
const decimal: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};
const currency: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
};
const clock: Intl.NumberFormatOptions = {
  minimumIntegerDigits: 2,
  useGrouping: false,
};
const locales = [
  ["en-US", "English · US"],
  ["de-DE", "Deutsch"],
  ["fr-FR", "Français"],
  ["hi-IN", "Hindi · India"],
  ["ja-JP", "日本語"],
  ["ar-EG", "العربية · Egypt"],
  ["fa-IR", "فارسی"],
] as const;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M4 12 12 4M4 4h8v8" : "M3 8h10M8 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Mark() {
  return (
    <svg
      className="brand-mark"
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="10"
        height="26"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="19"
        y="3"
        width="10"
        height="26"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M3 12h10M19 20h10" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="20" r="2" fill="currentColor" />
      <circle cx="24" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="select-wrap">
        <select
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {children}
        </select>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
        >
          <path d="m1 1 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

type MotionSettings = { locales: string; duration: number; reduced: boolean };

function Examples({ locales: locale, duration, reduced }: MotionSettings) {
  const [revenue, setRevenue] = useState({ value: 8240, animated: true });
  const [seconds, setSeconds] = useState({ value: 90, animated: true });
  const [running, setRunning] = useState(false);
  const [seats, setSeats] = useState({ value: 8, animated: true });
  const [large, setLarge] = useState({
    value: 9007199254740993n,
    animated: true,
  });
  const sliderPointer = useRef(false);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setSeconds((current) => ({
        value: Math.max(0, current.value - 1),
        animated: true,
      }));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (seconds.value === 0) setRunning(false);
  }, [seconds.value]);

  const shared = { locales: locale, duration };

  return (
    <section
      className="examples section"
      id="examples"
      aria-labelledby="examples-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">02 / A few possibilities</p>
          <h2 id="examples-title">Little details. Real life.</h2>
        </div>
        <p>
          Same component, different contexts.
          <br />
          No animation timeline to babysit.
        </p>
      </div>
      <div className="examples-grid">
        <article className="example">
          <div className="example-heading">
            <h3>A little momentum</h3>
            <p className="mono">01 — Metric</p>
          </div>
          <div className="example-number">
            <RollingNumber
              {...shared}
              value={revenue.value}
              format={currency}
              animated={!reduced && revenue.animated}
            />
          </div>
          <p className="example-description">
            Revenue this month. Room to grow.
          </p>
          <button
            type="button"
            className="button button-outline"
            onClick={(event) =>
              setRevenue((current) => ({
                value: current.value + 125,
                animated: event.detail > 0,
              }))
            }
          >
            Add a sale <span className="button-aside">+125 USD</span>
          </button>
        </article>
        <article className="example">
          <div className="example-heading">
            <h3>A moment to breathe</h3>
            <p className="mono">02 — Timer</p>
          </div>
          <div className="example-number timer" role="timer" aria-live="off">
            <span className="sr-only">{seconds.value} seconds remaining</span>
            <div aria-hidden="true">
              <RollingNumber
                {...shared}
                value={Math.floor(seconds.value / 60)}
                format={clock}
                animated={!reduced && seconds.animated}
              />
              <span className="timer-colon">:</span>
              <RollingNumber
                {...shared}
                value={seconds.value % 60}
                format={clock}
                animated={!reduced && seconds.animated}
              />
            </div>
          </div>
          <p className="example-description">
            A 90-second pause. Starts only when you do.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button-outline"
              disabled={seconds.value === 0}
              onClick={() => setRunning((current) => !current)}
            >
              {running ? "Pause timer" : "Start timer"}
              <span aria-hidden="true">{running ? "Ⅱ" : "▷"}</span>
            </button>
            <button
              type="button"
              className="button button-quiet"
              onClick={(event) => {
                setRunning(false);
                setSeconds({ value: 90, animated: event.detail > 0 });
              }}
            >
              Reset
            </button>
          </div>
        </article>
        <article className="example">
          <div className="example-heading">
            <h3>Find your sweet spot</h3>
            <p className="mono">03 — Pricing</p>
          </div>
          <div className="price-line">
            <div className="example-number">
              <RollingNumber
                {...shared}
                value={seats.value * 12}
                format={currency}
                animated={!reduced && seats.animated}
              />
            </div>
            <p>/ month</p>
          </div>
          <p className="example-description">
            12 USD per seat. Try dragging the slider.
          </p>
          <div className="seat-control">
            <label htmlFor="seats">
              Seats <output htmlFor="seats">{seats.value}</output>
            </label>
            <input
              id="seats"
              name="seats"
              type="range"
              min="1"
              max="24"
              value={seats.value}
              onPointerDown={() => {
                sliderPointer.current = true;
              }}
              onPointerUp={() => {
                sliderPointer.current = false;
              }}
              onPointerCancel={() => {
                sliderPointer.current = false;
              }}
              onKeyDown={() => {
                sliderPointer.current = false;
              }}
              onBlur={() => {
                sliderPointer.current = false;
              }}
              onChange={(event) =>
                setSeats({
                  value: Number(event.target.value),
                  animated: sliderPointer.current,
                })
              }
            />
          </div>
        </article>
        <article className="example example-bigint">
          <div className="example-heading">
            <h3>Every last digit matters</h3>
            <p className="mono">04 — BigInt</p>
          </div>
          <div className="example-number bigint-number">
            <RollingNumber
              {...shared}
              value={large.value}
              animated={!reduced && large.animated}
            />
          </div>
          <p className="example-description">
            Past the safe-integer limit. Still exactly one apart.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button-outline"
              onClick={(event) =>
                setLarge((current) => ({
                  value: current.value - 1n,
                  animated: event.detail > 0,
                }))
              }
            >
              Subtract 1
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={(event) =>
                setLarge((current) => ({
                  value: current.value + 1n,
                  animated: event.detail > 0,
                }))
              }
            >
              Add 1 <span aria-hidden="true">+</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function GettingStarted() {
  const [copyStatus, setCopyStatus] = useState("");
  const resetCopy = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (resetCopy.current !== null) clearTimeout(resetCopy.current);
    };
  }, []);

  async function copyInstall() {
    if (resetCopy.current !== null) clearTimeout(resetCopy.current);
    try {
      await navigator.clipboard.writeText("bun add @kitlangton/rolling-number");
      if (!mounted.current) return;
      setCopyStatus("Copied");
    } catch {
      if (!mounted.current) return;
      setCopyStatus("Select the command to copy");
    }
    resetCopy.current = setTimeout(() => setCopyStatus(""), 3000);
  }

  return (
    <section
      className="section getting-started"
      id="usage"
      aria-labelledby="usage-title"
    >
      <div className="usage-intro">
        <p className="eyebrow">03 / The whole idea</p>
        <h2 id="usage-title">
          Change the value.
          <br />
          <em>We’ll take it from here.</em>
        </h2>
        <p>
          Native number formatting. An imperative DOM core. A small React
          adapter. Nothing between your state and a little more character.
        </p>
        <p className="preview-note">
          Development preview. The install command below is for the first
          package release.
        </p>
        <div className="install">
          <code>bun add @kitlangton/rolling-number</code>
          <button
            type="button"
            onClick={copyInstall}
            aria-label="Copy planned install command"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 17 17"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="6"
                y="6"
                width="8"
                height="8"
                rx="1.5"
                stroke="currentColor"
              />
              <path
                d="M11 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1"
                stroke="currentColor"
              />
            </svg>
          </button>
        </div>
        <p className="copy-status" role="status">
          {copyStatus}
        </p>
      </div>
      <div className="code-panel">
        <div className="code-heading">
          <p>Just React. Just a number.</p>
          <p className="mono">tsx</p>
        </div>
        <pre tabIndex={0} aria-label="React usage example">
          <code>
            <span className="syntax-muted">{"import { "}</span>
            {"RollingNumber"}
            <span className="syntax-muted">{" } from "}</span>
            <span className="syntax-string">{'"@kitlangton/rolling-number/react"'}</span>
            {";\n"}
            <span className="syntax-muted">{"import "}</span>
            <span className="syntax-string">
              {'"@kitlangton/rolling-number/styles.css"'}
            </span>
            {";\n\n"}
            <span className="syntax-muted">{"export function "}</span>
            {"Price({ value }: { value: number }) {\n  "}
            <span className="syntax-muted">{"return (\n    "}</span>
            <span className="syntax-tag">{"<RollingNumber"}</span>
            {"\n      value={value}\n      locales="}
            <span className="syntax-string">{'"en-US"'}</span>
            {"\n      format={{\n        style: "}
            <span className="syntax-string">{'"currency"'}</span>
            {",\n        currency: "}
            <span className="syntax-string">{'"USD"'}</span>
            {"\n      }}\n    "}
            <span className="syntax-tag">{"/>"}</span>
            {"\n  );\n}"}
          </code>
        </pre>
        <div className="code-footer">
          <span className="small-dot" />
          No per-frame React state.
        </div>
      </div>
      <dl className="api-list">
        <div>
          <dt>value</dt>
          <dd>
            A <code>number</code> or <code>bigint</code>. The only required
            prop.
          </dd>
        </div>
        <div>
          <dt>locales · format</dt>
          <dd>
            The locale and options you already know from{" "}
            <code>Intl.NumberFormat</code>.
          </dd>
        </div>
        <div>
          <dt>duration · direction</dt>
          <dd>
            500 ms by default. Direction can be <code>auto</code>,{" "}
            <code>up</code>, or <code>down</code>.
          </dd>
        </div>
        <div>
          <dt>animated</dt>
          <dd>
            Set to <code>false</code> to settle immediately. System reduced
            motion is respected.
          </dd>
        </div>
      </dl>
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
  const stressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentValue = useRef(1284.5);
  const previousValue = useRef(9876.54);
  const unsupported = locale === "ar-EG" || locale === "fa-IR";

  useEffect(
    () => () => {
      if (stressTimer.current !== null) clearInterval(stressTimer.current);
    },
    [],
  );

  function stopStress() {
    if (stressTimer.current !== null) clearInterval(stressTimer.current);
    stressTimer.current = null;
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
    if (stressing) {
      stopStress();
      return;
    }
    const animate = event.detail > 0;
    const sequence = [
      9999.99, 10.01, 8765.43, 123.45, 999.99, 1000, 99.99, 100, -123.45, 0,
      6789.12, 1284.5,
    ];
    let index = 0;
    setStressing(true);
    changeValue(sequence[index++]!, animate);
    stressTimer.current = setInterval(() => {
      const next = sequence[index++];
      if (next === undefined) {
        stopStress();
        return;
      }
      changeValue(next, animate);
    }, 90);
  }

  return (
    <div className="site-shell">
      <a className="skip-link" href="#playground">
        Skip to playground
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Rolling Number home">
          <Mark />
          <span>rolling number</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#examples">Examples</a>
          <a href="#usage">Usage</a>
          <a href={repository} className="external-link">
            GitHub <Arrow diagonal />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-topline">
            <p className="eyebrow">
              <span className="small-dot" />
              An open-source number primitive
            </p>
            <p className="edition mono">TypeScript + React / 0.1 preview</p>
          </div>
          <div className="hero-heading">
            <h1 id="hero-title">
              Numbers,
              <br />
              <em>in good motion.</em>
            </h1>
            <div className="hero-description">
              <p>
                A little movement makes a number feel alive. Smooth,
                interruptible rolling digits for the interfaces you care about.
              </p>
              <a href="#usage" className="text-link">
                Meet the component <Arrow />
              </a>
            </div>
          </div>
        </section>

        <section
          className="playground"
          id="playground"
          aria-label="Interactive number playground"
        >
          <div className="specimen-top">
            <p className="eyebrow">01 / The live specimen</p>
            <p className="mono specimen-status">
              <span className="small-dot" />
              {stressing
                ? "12 changes / 90 ms apart"
                : "Go on, give it a nudge"}
            </p>
          </div>
          <div
            className={`number-stage font-${font} ${tabular ? "digits-tabular" : "digits-proportional"}`}
            style={{ "--number-scale": size / 144 } as CSSProperties}
          >
            <div className="number-frame">
              <RollingNumber
                value={hero.value}
                locales={locale}
                format={decimal}
                duration={duration}
                animated={!reduced && hero.animated}
                direction={direction}
              />
            </div>
            <div className="specimen-baseline" aria-hidden="true">
              <span />
              <span />
            </div>
          </div>
          <div className="play-actions">
            <div className="value-control">
              <label className="sr-only" htmlFor="number-value">
                Number value
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label="Subtract one hundred"
                onClick={(event) => adjust(event, -100)}
              >
                −
              </button>
              <input
                id="number-value"
                name="number-value"
                type="number"
                step="0.01"
                value={input}
                onChange={(event) => {
                  stopStress();
                  setInput(event.target.value);
                  const value = event.target.valueAsNumber;
                  if (Number.isFinite(value)) {
                    previousValue.current = currentValue.current;
                    currentValue.current = value;
                    setHero({ value, animated: false });
                  }
                }}
                onBlur={() => setInput(currentValue.current.toFixed(2))}
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Add one hundred"
                onClick={(event) => adjust(event, 100)}
              >
                +
              </button>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="button button-primary"
                onClick={(event) => {
                  stopStress();
                  const next = Math.round(Math.random() * 999999) / 100;
                  changeValue(
                    next === currentValue.current ? next + 1 : next,
                    event.detail > 0,
                  );
                }}
              >
                Shuffle{" "}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 4h2c3 0 5 8 8 8h2M11 9l3 3-3 3M2 12h2c1 0 2-1 3-3m2-2c1-2 2-3 3-3h2M11 1l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="button button-outline"
                onClick={(event) => {
                  stopStress();
                  changeValue(previousValue.current, event.detail > 0);
                }}
              >
                Reverse <span aria-hidden="true">↶</span>
              </button>
              <button
                type="button"
                className="button button-quiet"
                aria-pressed={stressing}
                onClick={stress}
              >
                {stressing ? "Stop sequence" : "Stress test"}
                <span aria-hidden="true">↯</span>
              </button>
            </div>
          </div>
          <div className="settings">
            <Select
              id="locale"
              label="Locale"
              value={locale}
              onChange={(next) => {
                stopStress();
                setLocale(next);
                setHero((value) => ({ ...value, animated: false }));
              }}
            >
              {locales.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              id="typeface"
              label="Typeface"
              value={font}
              onChange={setFont}
            >
              <option value="sans">System sans</option>
              <option value="serif">Editorial serif</option>
              <option value="mono">Monospace</option>
            </Select>
            <Select
              id="duration"
              label="Duration"
              value={String(duration)}
              onChange={(value) => setDuration(Number(value))}
            >
              <option value="200">200 ms · quick</option>
              <option value="500">500 ms · default</option>
              <option value="1000">1,000 ms · slow</option>
            </Select>
            <Select
              id="direction"
              label="Direction"
              value={direction}
              onChange={(value) => {
                if (value === "auto" || value === "up" || value === "down")
                  setDirection(value);
              }}
            >
              <option value="auto">Automatic</option>
              <option value="up">Always up</option>
              <option value="down">Always down</option>
            </Select>
            <div className="field size-field">
              <label htmlFor="font-size">
                Type size{" "}
                <output htmlFor="font-size">
                  {Math.round((size / 144) * 100)}%
                </output>
              </label>
              <input
                id="font-size"
                name="font-size"
                type="range"
                min="72"
                max="176"
                step="8"
                value={size}
                aria-valuetext={`${Math.round((size / 144) * 100)} percent`}
                onChange={(event) => setSize(Number(event.target.value))}
              />
            </div>
            <div className="toggle-fields">
              <label className="check-label">
                <input
                  type="checkbox"
                  name="tabular-numerals"
                  checked={tabular}
                  onChange={(event) => setTabular(event.target.checked)}
                />
                Tabular digits
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="reduced-motion"
                  checked={reduced}
                  onChange={(event) => setReduced(event.target.checked)}
                />
                Reduce motion
              </label>
            </div>
          </div>
          <div className="playground-note">
            <p>
              {unsupported
                ? "This locale uses intact native text. RTL and non-Latin digit animation are not supported in this preview."
                : "Try reversing mid-roll. The latest value takes over, without a queue."}
            </p>
            <p>
              Keyboard changes settle immediately. Your system’s motion
              preference always applies.
            </p>
          </div>
        </section>

        <Examples locales={locale} duration={duration} reduced={reduced} />
        <GettingStarted />
        <section className="research-section" aria-labelledby="research-title">
          <div>
            <p className="eyebrow">04 / A considered foundation</p>
            <h2 id="research-title">
              Smooth is a feeling.
              <br />
              Performance is a measurement.
            </h2>
          </div>
          <div className="research-copy">
            <p>
              Built around native formatting, readable fallbacks, and animation
              work that stays out of React’s render loop. The tradeoffs are part
              of the project, not fine print.
            </p>
            <div className="research-links">
              <a className="text-link" href="./bench.html">
                Open the benchmark <Arrow diagonal />
              </a>
              <a
                className="text-link"
                href={`${repository}/blob/main/docs/research.md`}
              >
                Read the research <Arrow diagonal />
              </a>
            </div>
            <p className="research-footnote">
              Compact and scientific notation, RTL, and unsupported digit
              scripts keep their intact formatted text. We’d rather skip the
              motion than get the number wrong.
            </p>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <a href="#" className="brand">
          <Mark />
          <span>rolling number</span>
        </a>
        <p>A small detail, thoughtfully done.</p>
        <a href={`${repository}/blob/main/LICENSE`} className="external-link">
          Open source · MIT <Arrow diagonal />
        </a>
      </footer>
    </div>
  );
}

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
