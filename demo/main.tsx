import { StrictMode, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RollingNumber } from "../src/react";
import { Track } from "../src/track";
import { spring } from "../src/motion";
import { ActivityGraphic, AvatarGraphic, FileGraphic, LedgerGraphic, ShirtGraphic, WeatherGraphic } from "./MiniGraphics";
import { installCommands, repository } from "./install";
import "../src/styles.css";
import "./demo.css";

type PackageManager = keyof typeof installCommands;

/** The same critically damped spring the digits use, as a native easing for width and position. */
function springEasing(duration: number): string {
  return `linear(${spring(0, 1, 0, duration).points.map((point) => point.toFixed(5)).join(",")})`;
}

/** Copies text and reports briefly; also readable by assistive technology through the status region. */
function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [copied, (text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    }).catch(() => setCopied(false));
  }];
}

/** Parses the animated clip so an interrupted slide continues from where it is drawn. */
function readInset(element: HTMLElement): { left: number; right: number } | undefined {
  const match = /inset\(\S+ (\S+)px \S+ (\S+)px/.exec(getComputedStyle(element).clipPath);
  return match ? { right: Number(match[1]), left: Number(match[2]) } : undefined;
}

/**
 * Segmented control with a sliding pill. The pill is an overlay of bright label
 * copies clipped to the selected segment, so each label turns white exactly as the
 * pill passes underneath. Slides run on the shared spring and resume from the
 * drawn clip when interrupted.
 */
function Segmented<T extends string>({ options, value, onChange, label, duration, reduced, format = (option) => option }: {
  options: readonly T[]; value: T; onChange: (value: T, animated: boolean) => void; label: string; duration: number; reduced: boolean; format?: (option: T) => string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const highlight = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useLayoutEffect(() => {
    const element = group.current, overlay = highlight.current;
    const target = element?.querySelector<HTMLElement>("button[aria-pressed='true']");
    if (!element || !overlay || !target) return;
    const from = readInset(overlay);
    for (const animation of overlay.getAnimations()) animation.cancel();
    const first = !started.current;
    started.current = true;
    const clip = (left: number, right: number) => `inset(0px ${right}px 0px ${left}px round 6px)`;
    const to = { left: target.offsetLeft, right: element.offsetWidth - target.offsetLeft - target.offsetWidth };
    const start = from ?? to;
    overlay.animate([{ clipPath: clip(start.left, start.right) }, { clipPath: clip(to.left, to.right) }], { duration: reduced || first ? 0 : duration, easing: springEasing(duration), fill: "forwards" });
  }, [value, duration, reduced]);
  return (
    <div ref={group} className="segmented" role="group" aria-label={label}>
      {options.map((option) => <button key={option} aria-pressed={value === option} onClick={(event) => onChange(option, event.detail > 0)}>{format(option)}</button>)}
      <div ref={highlight} className="segmented-highlight" aria-hidden="true">{options.map((option) => <span key={option}>{format(option)}</span>)}</div>
    </div>
  );
}

/** Height/opacity reveal on the shared spring; the panel is inert and hidden once closed. */
function Disclosure({ open, duration, reduced, id, children }: { open: boolean; duration: number; reduced: boolean; id: string; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useLayoutEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const first = !started.current;
    started.current = true;
    const rendered = element.getBoundingClientRect().height;
    for (const animation of element.getAnimations({ subtree: true })) animation.cancel();
    element.hidden = false;
    const target = open ? element.scrollHeight : 0;
    if (first || reduced || rendered === target) {
      element.hidden = !open;
      return;
    }
    const easing = springEasing(duration);
    const animation = element.animate([{ height: `${rendered}px` }, { height: `${target}px` }], { duration, easing, fill: "forwards" });
    element.firstElementChild?.animate(
      [{ opacity: rendered > target ? getComputedStyle(element.firstElementChild).opacity : 0, transform: open ? "translateY(-6px)" : "none" }, { opacity: open ? 1 : 0, transform: open ? "none" : "translateY(-6px)" }],
      { duration: duration * .65, easing, fill: "forwards" },
    );
    animation.onfinish = () => {
      for (const running of element.getAnimations({ subtree: true })) running.cancel();
      element.hidden = !open;
    };
  }, [open, duration, reduced]);
  return <div ref={wrap} id={id} className="disclosure" inert={!open || undefined}>{children}</div>;
}

function Install({ duration, reduced }: { duration: number; reduced: boolean }) {
  const [manager, setManager] = useState<PackageManager>("bun");
  const [copied, copy] = useCopy();
  const command = installCommands[manager];
  const code = useRef<HTMLElement>(null);
  const started = useRef(false);
  useLayoutEffect(() => {
    const box = code.current;
    if (!box) return;
    // Read the rendered width first (an interruption point), then release the
    // previous effect to read the natural target width.
    const rendered = box.getBoundingClientRect().width;
    for (const animation of box.getAnimations()) animation.cancel();
    const width = box.getBoundingClientRect().width;
    const first = !started.current;
    started.current = true;
    if (first || reduced) return;
    box.animate([{ width: `${rendered}px` }, { width: `${width}px` }], { duration, easing: springEasing(duration), fill: "forwards" });
  }, [manager, duration, reduced]);
  return (
    <section className="install" aria-label="Install">
      <div className="install-command">
        <Segmented options={Object.keys(installCommands) as PackageManager[]} value={manager} onChange={setManager} label="Package manager" duration={duration} reduced={reduced} />
        <code ref={code}><span key={manager} className="install-text" data-animated={!reduced}>{command}</span></code>
        <button className="quiet" aria-label="Copy install command" onClick={() => copy(command)}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <output className="sr-only" aria-live="polite">{copied ? "Copied to clipboard" : ""}</output>
    </section>
  );
}

const currency: Intl.NumberFormatOptions = { style: "currency", currency: "USD", maximumFractionDigits: 0 };
const milliseconds: Intl.NumberFormatOptions = { style: "unit", unit: "millisecond", unitDisplay: "short", maximumFractionDigits: 0 };
const percent: Intl.NumberFormatOptions = { style: "percent", maximumFractionDigits: 0 };
const temperature: Intl.NumberFormatOptions = { style: "unit", unit: "celsius", signDisplay: "exceptZero", minimumFractionDigits: 1, maximumFractionDigits: 1 };
const currencies = ["USD", "EUR", "JPY", "GBP"];
const localeOptions = [["en-US", "English"], ["de-DE", "Deutsch"], ["fr-FR", "Français"], ["hi-IN", "Hindi"], ["ja-JP", "日本語"], ["ar-EG", "العربية"], ["fa-IR", "فارسی"]];

const Examples = memo(function Examples({ locale, duration, reduced, motionBlur }: { locale: string; duration: number; reduced: boolean; motionBlur: boolean }) {
  const [revenue, setRevenue] = useState({ value: 8240, animated: true });
  const [likes, setLikes] = useState({ value: 1204, animated: true });
  const heart = useRef<SVGSVGElement>(null);
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
  const shared = { locales: locale, duration, motionBlur };
  return (
    <section id="examples" className="examples" aria-label="Examples" data-reduced={reduced} style={{ "--duration": `${duration}ms`, "--spring": springEasing(duration) } as CSSProperties}>
      <article className="example mini-app shop-app">
        <h2>Shop</h2>
        <div className="shop-product">
          <div className="product-art"><ShirtGraphic /></div>
          <div className="product-info"><strong>Studio tee</strong><span>Washed black · $125</span><button className="mini-button" aria-label="Buy Studio tee" onClick={(event) => { flashSale(event.detail > 0); setRevenue((current) => ({ value: current.value + 125, animated: event.detail > 0 })); }}>Buy</button></div>
        </div>
        <div className="app-metric"><span className="mini-label">Revenue</span><div ref={revenueNumber} className="example-number revenue-number"><RollingNumber {...shared} value={revenue.value} format={currency} animated={!reduced && revenue.animated} /></div></div>
      </article>
      <article className="example mini-app likes-app">
        <h2>Likes</h2>
        <div className="likes-body">
          <button className="heart" aria-label="Like" onClick={(event) => {
            const animated = !reduced && event.detail > 0;
            // Replace, never stack: a fast tap restarts the pop from its current scale.
            if (animated && heart.current) {
              const current = new DOMMatrix(getComputedStyle(heart.current).transform).a || 1;
              for (const running of heart.current.getAnimations()) running.cancel();
              heart.current.animate([{ transform: `scale(${Math.min(current, .72)})` }, { transform: "scale(1)" }], { duration, easing: springEasing(duration) });
            }
            setLikes((current) => ({ value: current.value + 1, animated }));
          }}>
            <svg ref={heart} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z" /></svg>
          </button>
          <div className="example-number"><RollingNumber {...shared} value={likes.value} animated={!reduced && likes.animated} /></div>
        </div>
        <span className="mini-label centered-label">Tap quickly. Digits keep rolling.</span>
      </article>
      <article className="example mini-app team-app">
        <h2>Team plan</h2>
        <div className="avatar-stack" aria-hidden="true" data-animated={!reduced && seats.animated}>{Array.from({ length: 5 }, (_, index) => <span className="mini-avatar" key={index} data-present={index < seats.value}><AvatarGraphic /></span>)}<span className="extra-members" data-present={seats.value > 5}>+<RollingNumber {...shared} value={Math.max(0, seats.value - 5)} animated={!reduced && seats.animated} /></span></div>
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
        <div className="currency-switch"><Segmented options={currencies} value={currencies[currencyIndex.value]!} onChange={(code, animated) => setCurrencyIndex({ value: currencies.indexOf(code), animated })} label="Invoice currency" duration={duration} reduced={reduced} /></div>
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
  const [options, setOptions] = useState(false);
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
          <div className="settings-panel">
            <button className="quiet settings-toggle" aria-expanded={options} aria-controls="settings" onClick={() => setOptions((current) => !current)}>Options <span aria-hidden="true">{options ? "−" : "+"}</span></button>
            <Disclosure id="settings" open={options} duration={duration} reduced={reduced}>
            <div className="settings">
              <label>Locale<select id="locale" value={locale} onChange={(event) => setLocale(event.target.value)}>{localeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Typeface<select id="typeface" value={font} onChange={(event) => setFont(event.target.value)}><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select></label>
              <label>Duration<select id="duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value="200">200 ms</option><option value="500">500 ms</option><option value="1000">1000 ms</option></select></label>
              <label>Direction<select id="direction" value={direction} onChange={(event) => { const value = event.target.value; if (value === "auto" || value === "up" || value === "down") setDirection(value); }}><option value="auto">Auto</option><option value="up">Up</option><option value="down">Down</option></select></label>
              <label className="size-control">Size <output>{Math.round(size / 144 * 100)}%</output><input id="font-size" type="range" min="72" max="176" step="8" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
              <div className="toggles"><label><input type="checkbox" checked={tabular} onChange={(event) => setTabular(event.target.checked)} />Tabular digits</label><label><input type="checkbox" checked={motionBlur} onChange={(event) => setMotionBlur(event.target.checked)} />Motion blur</label><label><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />Reduce motion</label></div>
            </div>
            </Disclosure>
          </div>
          {staticLocale && <p className="locale-note">This locale uses native text without rolling.</p>}
        </section>
        <Install duration={duration} reduced={reduced} />
        <Examples locale={locale} duration={duration} reduced={reduced} motionBlur={motionBlur} />
      </main>
      <footer className="site-footer"><code>{"<RollingNumber value={value} />"}</code><a href="./llms.txt">llms.txt</a><a href={`${repository}/blob/main/LICENSE`}>MIT</a></footer>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
