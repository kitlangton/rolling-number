import { StrictMode, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { RollingText } from "../src/react";
import { repository } from "./install";
import { createBoardSound } from "./board-sound";
import { advance, queue, rowCount, statuses, titleWidth } from "./pull-requests";
import { createGpuFlaps } from "./gpu-flap";
import { glyphs } from "./gpu-flap-atlas";
import "../src/styles.css";
import "./demo.css";
import "./board.css";

const clockHourDrums = ["012", "0123456789"];
const clockMinuteDrums = ["012345", "0123456789"];
// Two permanent slots, including a blank tens card, even when comments are single-digit.
const commentDrums = [" 0123456789", "0123456789"];

function pad(value: number): string { return String(value).padStart(2, "0"); }

function FlapText({ gpu, ...props }: ComponentProps<typeof RollingText> & { gpu: boolean }) {
  if (!gpu) return <RollingText {...props} />;
  return <span className="gpu-field" data-wheels={Array.isArray(props.charset) ? props.charset.join("|") : props.charset ?? glyphs} data-cadence={props.flipDuration ?? 110} data-stagger={props.stagger} data-blur={props.motionBlur ? (props.flipDuration === 220 ? 2 : 1) : 0}>{props.text}</span>;
}

function Board() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [board, setBoard] = useState(() => queue(seed));
  const [paused, setPaused] = useState(false);
  const [renderer, setRenderer] = useState(() => new URLSearchParams(location.search).get("renderer") === "dom" ? "dom" : "gpu");
  const [gpuUnavailable, setGpuUnavailable] = useState(false);
  const gpu = useRef<ReturnType<typeof createGpuFlaps>>(undefined);
  const [fullBlur, setFullBlur] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [clock, setClock] = useState(() => new Date());
  const element = useRef<HTMLElement>(null);
  const sound = useRef<ReturnType<typeof createBoardSound> | null>(null);
  const [soundState, setSoundState] = useState<"off" | "on" | "unavailable">("off");
  const duration = 900;
  useEffect(() => {
    const controller = createBoardSound(element.current!, setSoundState, renderer === "gpu" ? (previous, now) => gpu.current?.impacts(previous, now) ?? { ticks: 0, clacks: 0, active: false } : undefined);
    sound.current = controller;
    return () => { controller.destroy(); sound.current = null; };
  }, [renderer]);
  useLayoutEffect(() => {
    setGpuUnavailable(false);
    if (renderer !== "gpu" || reduced) return;
    gpu.current = createGpuFlaps(element.current!, () => sound.current?.wake(), () => { setGpuUnavailable(true); sound.current?.mute(); });
    return () => { gpu.current?.destroy(); gpu.current = undefined; };
  }, [renderer, reduced]);
  useLayoutEffect(() => { gpu.current?.update(); }, [board, clock, fullBlur, sweeping]);
  useEffect(() => { if (reduced) sound.current?.mute(); }, [reduced]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const listener = () => setReduced(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (paused) return;
    // Review/CI states change between new arrivals; the feed advances every few beats.
    let beat = 0;
    const timer = setInterval(() => {
      beat++;
      if (beat % 4 === 0) {
        setSweeping(true);
        setSeed((current) => current + 1);
        setBoard((current) => advance(current, seed + beat));
      } else {
        setSweeping(false);
        setBoard((current) => current.map((row, index) => index === beat % rowCount ? { ...row, status: statuses[(statuses.indexOf(row.status) + 1 + (beat % 3)) % statuses.length]! } : row));
      }
    }, 2600);
    return () => clearInterval(timer);
  }, [paused, seed]);
  const shared = useMemo(() => ({ gpu: renderer === "gpu", duration, animated: !reduced, motionBlur: fullBlur, mode: "flap" as const, stagger: "start" as const }), [renderer, reduced, fullBlur]);
  const clockMotion = { ...shared, motionBlur: true, stagger: "none" as const, flipDuration: 220 };
  return (
    <div className="site-shell board-shell">
      <a className="skip-link" href="#board">Skip to board</a>
      <header className="site-header">
        <div className="brand"><h1>the flap board</h1></div>
        <span className="muted">a rendering experiment</span>
      </header>
      <main>
        <section ref={element} className="board" id="board" aria-label="Pull requests" data-renderer={renderer}>
          <div className="board-head">
            <span className="board-title"><FlapText {...shared} text="PULL REQUESTS" /></span>
            <span className="board-clock" role="timer" aria-label="Local time" aria-live="off">
              <FlapText {...clockMotion} text={pad(clock.getHours())} charset={clockHourDrums} /><span className="board-colon">:</span>
              <FlapText {...clockMotion} text={pad(clock.getMinutes())} charset={clockMinuteDrums} /><span className="board-colon">:</span>
              <FlapText {...clockMotion} text={pad(clock.getSeconds())} charset={clockMinuteDrums} />
            </span>
          </div>
          <table className="board-table">
            <thead><tr><th scope="col">PR</th><th scope="col">Title</th><th scope="col" aria-label="Comments">CMTS</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {board.map((row, index) => (
                <tr key={index} data-status={row.status}>
                  <td><span className="board-prefix">#</span><FlapText {...shared} text={String(row.number).padStart(4, "0")} charset="0123456789" /></td>
                  <td><FlapText {...shared} text={row.title.padEnd(titleWidth)} charset=" ABCDEFGHIJKLMNOPQRSTUVWXYZ" /></td>
                  <td><FlapText {...shared} text={String(row.comments).padStart(2)} charset={commentDrums} /></td>
                  <td><FlapText {...shared} motionBlur={fullBlur || !sweeping} text={row.status.padEnd(9)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="board-controls">
          <label className="board-toggle">Renderer <select aria-label="Renderer" value={renderer} onChange={(event) => setRenderer(event.target.value)}><option value="gpu">WebGL2</option><option value="dom">DOM</option></select></label>
          <button className="mini-button" onClick={() => setPaused((current) => !current)}>{paused ? "Resume" : "Pause"}</button>
          <button className="quiet muted" onClick={() => { setSweeping(true); setSeed((current) => current + 7); setBoard((current) => advance(current, seed + 7)); }}>Next PR</button>
          <button className="mini-button" aria-pressed={soundState === "on"} aria-label="Sound" disabled={reduced} onClick={() => void sound.current?.toggle()}>Sound {soundState === "on" ? "on" : "off"}</button>
          <label className="board-toggle"><input type="checkbox" checked={fullBlur} disabled={reduced} onChange={(event) => setFullBlur(event.target.checked)} />Full-board blur</label>
          <label className="board-toggle"><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />Reduce motion</label>
        </div>
        {soundState === "unavailable" && <p className="board-note" role="status">Audio is unavailable in this browser. The board still works without sound.</p>}
        {gpuUnavailable && <p className="board-note" role="status">WebGL2 is unavailable. Showing readable HTML; you can also try the DOM renderer.</p>}
        <p className="board-note">A very serious mechanical pull-request queue. Simulated titles, comments, and review/CI states—not connected to GitHub. WebGL2 uses one canvas and cached sharp/vertical-blur glyphs; DOM is here for comparison. Sound is synthesized locally. This experiment is separate from the Rolling Number library.</p>
      </main>
      <footer className="site-footer"><span>the flap board</span><a href={`${repository}/blob/main/LICENSE`}>MIT</a></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Board /></StrictMode>);
