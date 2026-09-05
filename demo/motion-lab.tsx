import { StrictMode, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { createRollingNumber, type RollingNumberController } from "../src/index";
import { motionExperiments, type MotionExperiment } from "../src/experimental";
import "../src/styles.css";
import "./demo.css";
import "./motion-lab.css";

const defaults: MotionExperiment = { widthDuration: 500, entryDuration: 500, entryHold: .14, entryDistance: 1, fadeDuration: 500, entryOrigin: 0 };
const presets: { name: string; description: string; settings: MotionExperiment }[] = [
  { name: "Current", description: "The original full-row rise.", settings: defaults },
  { name: "Almost still", description: "A tiny lift. Mostly just making room.", settings: { ...defaults, widthDuration: 400, entryDuration: 300, entryHold: 0, entryDistance: .08, fadeDuration: 250, entryOrigin: 1 } },
  { name: "Quiet fade", description: "No vertical travel. Dissolve into place.", settings: { ...defaults, widthDuration: 550, entryDistance: 0, fadeDuration: 700, entryOrigin: 1 } },
  { name: "Slide only", description: "Unfold sideways from the existing digits.", settings: { ...defaults, widthDuration: 700, entryDistance: 0, fadeDuration: 400, entryOrigin: 0 } },
  { name: "Quick rise", description: "A short, brisk lift into the new space.", settings: { ...defaults, widthDuration: 350, entryDuration: 350, entryHold: .08, entryDistance: .35, fadeDuration: 300, entryOrigin: .8 } },
  { name: "Together", description: "Width and full-height rise move as one.", settings: { ...defaults, widthDuration: 600, entryDuration: 600, entryHold: 0, fadeDuration: 600 } },
  { name: "Room first", description: "Open the gap, then a gentler half-rise.", settings: { ...defaults, widthDuration: 650, entryDuration: 500, entryHold: .3, entryDistance: .55, fadeDuration: 350, entryOrigin: .6 } },
  { name: "Late arrival", description: "A deliberate pause before the one appears.", settings: { ...defaults, widthDuration: 350, entryDuration: 850, entryHold: .65, entryOrigin: 1 } },
  { name: "Lead with the one", description: "The one lands early; the zeros spread after.", settings: { ...defaults, widthDuration: 950, entryDuration: 200, entryHold: 0, entryDistance: .25, fadeDuration: 150, entryOrigin: 1 } },
  { name: "Drop in", description: "Enter from above instead of below.", settings: { ...defaults, widthDuration: 450, entryDuration: 450, entryHold: .22, entryDistance: -.7, fadeDuration: 350, entryOrigin: 1 } },
  { name: "Soft drop", description: "A small downward drift and soft fade.", settings: { ...defaults, widthDuration: 600, entryDuration: 650, entryHold: .1, entryDistance: -.18, fadeDuration: 650, entryOrigin: .85 } },
  { name: "Hard cut width", description: "Snap the gap open; animate only the entry.", settings: { ...defaults, widthDuration: 0, entryDuration: 350, entryHold: .18, entryDistance: .5, fadeDuration: 300, entryOrigin: 1 } },
];
const pairs = [[999, 1000], [99, 100], [9999, 10000], [9, 1000]] as const;

function Preview({ value, animated, duration, blur, experiment }: { value: number; animated: boolean; duration: number; blur: boolean; experiment?: MotionExperiment }) {
  const host = useRef<HTMLSpanElement>(null);
  const controller = useRef<RollingNumberController | null>(null);
  useLayoutEffect(() => {
    const element = host.current!;
    controller.current = createRollingNumber(element, { value, locales: "en-US", duration, motionBlur: blur, animated });
    return () => { controller.current?.destroy(); motionExperiments.delete(element); };
  }, []);
  useLayoutEffect(() => {
    const element = host.current!;
    if (experiment) motionExperiments.set(element, experiment);
    else motionExperiments.delete(element);
    controller.current?.update({ value, duration, motionBlur: blur, animated });
  });
  // The controller owns the full subtree, including its one accessible value.
  return <span ref={host} />;
}

function Slider({ label, value, min = 0, max, step, unit, onChange }: { label: string; value: number; min?: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  const id = useId();
  return <label className="lab-slider" htmlFor={id}><span>{label}</span><output htmlFor={id}>{Math.round(value)}{unit}</output><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function MotionLab() {
  const [settings, setSettings] = useState(defaults);
  const [pairIndex, setPairIndex] = useState(0);
  const [high, setHigh] = useState(false);
  const [take, setTake] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [blur, setBlur] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [alignment, setAlignment] = useState("center");
  const [copied, setCopied] = useState(false);
  const replayFrame = useRef(0);
  const replayRequested = useRef(false);
  const previews = useRef<HTMLDivElement>(null);
  const pair = pairs[pairIndex]!;
  const presetIndex = presets.findIndex((preset) => JSON.stringify(settings) === JSON.stringify(preset.settings));
  const selectedPreset = presets[presetIndex];
  const quiet = reduced || systemReduced;
  const experiment = { ...settings, widthDuration: settings.widthDuration * speed, entryDuration: settings.entryDuration * speed, fadeDuration: settings.fadeDuration * speed };
  const cycle = (Math.max(500, settings.widthDuration, settings.entryDuration, settings.fadeDuration) + 650) * speed;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setSystemReduced(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!loop || quiet) return;
    const timer = setInterval(() => { if (!document.hidden) setHigh((current) => !current); }, cycle);
    return () => clearInterval(timer);
  }, [loop, quiet, cycle]);
  useLayoutEffect(() => {
    if (!replayRequested.current) return;
    // Child layout effects queued initial geometry first. Give it a complete
    // frame, then retarget on the following frame, even if Safari starts late.
    replayFrame.current = requestAnimationFrame(() => {
      replayFrame.current = requestAnimationFrame(() => {
        replayFrame.current = 0;
        replayRequested.current = false;
        setHigh(true);
      });
    });
    return () => cancelAnimationFrame(replayFrame.current);
  }, [take]);
  function cancelReplay() {
    cancelAnimationFrame(replayFrame.current);
    replayFrame.current = 0;
    replayRequested.current = false;
  }
  function stop() { cancelReplay(); setLoop(false); }
  function replay() {
    // Explicit replay starts a fresh, already-enabled renderer at the low value.
    // Disabling animation for the reset would also disable the first expansion.
    stop(); setTake((current) => current + 1); setHigh(false);
    replayRequested.current = true;
  }
  function update(key: keyof MotionExperiment, value: number) { setSettings((current) => ({ ...current, [key]: value })); setCopied(false); }
  function choosePreset(index: number) {
    setSettings(presets[(index + presets.length) % presets.length]!.settings);
    setCopied(false);
    const bounds = previews.current?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > innerHeight)) previews.current?.scrollIntoView({ block: "start", behavior: "instant" });
    replay();
  }
  return <div className="site-shell lab-shell">
    <header className="site-header"><a className="brand" href="./"><h1>rolling number</h1></a><a href="./">← Showcase</a></header>
    <main>
      <div className="lab-heading"><div><h2>Width & entrance</h2><p>Make room for one more place. Compare, slow it down, interrupt it.</p></div><span className="lab-badge">Motion lab</span></div>
      <div ref={previews} className="lab-previews" style={{ "--lab-align": alignment } as CSSProperties}>
        <section aria-label="Current preview"><h3>Current <span>Library defaults</span></h3><div className="lab-number"><Preview key={take} value={high ? pair[1] : pair[0]} duration={500 * speed} animated={!quiet} blur={blur} /></div></section>
        <section aria-label="Experiment preview"><h3>Experiment <span>{selectedPreset?.name ?? "Custom"}</span></h3><div className="lab-number"><Preview key={take} value={high ? pair[1] : pair[0]} duration={500 * speed} animated={!quiet} blur={blur} experiment={experiment} /></div></section>
      </div>
      <div className="lab-transport">
        <button onClick={replay}>Replay expansion</button>
        <button onClick={() => { stop(); setHigh((current) => !current); }}>Reverse now</button>
        <button aria-pressed={loop} disabled={quiet} onClick={() => { cancelReplay(); setLoop((current) => !current); }}>{loop ? "Stop loop" : "Loop"}</button>
        <label>Transition<select value={pairIndex} onChange={(event) => { stop(); setTake((current) => current + 1); setHigh(false); setPairIndex(Number(event.target.value)); }}>{pairs.map(([from, to], index) => <option key={index} value={index}>{from.toLocaleString("en-US")} ↔ {to.toLocaleString("en-US")}</option>)}</select></label>
        <label>Playback<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={1}>1× · Real time</option><option value={2}>½× · Slow</option><option value={4}>¼× · Very slow</option></select></label>
      </div>
      <section className="lab-preset-section" aria-label="Motion presets">
        <div className="lab-preset-heading"><div><h3>12 different directions</h3><p>Select one to replay. Or step through without leaving the preview.</p></div><div className="lab-preset-nav"><button aria-label="Previous preset" onClick={() => choosePreset(presetIndex < 0 ? presets.length - 1 : presetIndex - 1)}>←</button><button aria-label="Next preset" onClick={() => choosePreset(presetIndex + 1)}>→</button></div></div>
        <div className="lab-presets">{presets.map((preset, index) => <button key={preset.name} aria-label={preset.name} aria-pressed={presetIndex === index} onClick={() => choosePreset(index)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div>
      </section>
      <div className="lab-controls">
        <fieldset><legend>Horizontal space</legend><p>Move the existing digits without stretching their shapes.</p>
          <Slider label="Width duration" value={settings.widthDuration} max={1500} step={25} unit=" ms" onChange={(value) => update("widthDuration", value)} />
          <Slider label="New digit starts at" value={settings.entryOrigin * 100} max={100} step={5} unit="%" onChange={(value) => update("entryOrigin", value / 100)} />
          <p className="lab-hint">0% = beside the old digits · 100% = its final position</p>
        </fieldset>
        <fieldset><legend>New digit</legend><p>Separate the rise from the width spring and the fade.</p>
          <Slider label="Entrance duration" value={settings.entryDuration} min={100} max={1500} step={25} unit=" ms" onChange={(value) => update("entryDuration", value)} />
          <Slider label="Wait before rising" value={settings.entryHold * 100} max={70} step={1} unit="%" onChange={(value) => update("entryHold", value / 100)} />
          <Slider label="Rise distance" value={settings.entryDistance * 100} min={-125} max={125} step={1} unit="% of a row" onChange={(value) => update("entryDistance", value / 100)} />
          <p className="lab-hint">Negative = enter from above · 0 = fade only</p>
          <Slider label="Fade duration" value={settings.fadeDuration} min={100} max={1500} step={25} unit=" ms" onChange={(value) => update("fadeDuration", value)} />
        </fieldset>
      </div>
      <div className="lab-options"><label>Alignment<select value={alignment} onChange={(event) => { stop(); setTake((current) => current + 1); setAlignment(event.target.value); }}><option value="flex-start">Left</option><option value="center">Center</option><option value="flex-end">Right</option></select></label><label><input type="checkbox" checked={blur} onChange={(event) => setBlur(event.target.checked)} /> Motion blur</label><label><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} /> Reduce motion</label><button onClick={() => navigator.clipboard?.writeText(JSON.stringify(settings, null, 2)).then(() => setCopied(true)).catch(() => setCopied(false))}>{copied ? "Copied settings" : "Copy settings"}</button><span role="status">{copied ? "Settings copied" : quiet ? "Reduced motion is active." : "Changes apply on the next transition."}</span></div>
      <p className="lab-footnote">Experimental controls, not a public API. Existing digits keep their 500 ms roll; new grouping commas join the entrance stagger with a short, sharp fade. Playback speed slows both previews equally. Replay and Reverse explicitly preview motion, including from the keyboard; reduced motion always wins.</p>
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><MotionLab /></StrictMode>);
