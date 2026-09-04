import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { RollingNumber, RollingText } from "../src/react";
import { repository } from "./install";
import "../src/styles.css";
import "./demo.css";
import "./board.css";

interface Departure { time: string; destination: string; platform: number; status: string }

const destinations = ["EDINBURGH", "GLASGOW", "MANCHESTER", "BRISTOL", "CARDIFF", "NEWCASTLE", "YORK", "OXFORD", "LEEDS", "PENZANCE", "ABERDEEN", "INVERNESS", "NORWICH", "BRIGHTON", "LIVERPOOL"];
const statuses = ["ON TIME", "ON TIME", "ON TIME", "DELAYED", "BOARDING", "EXP 5 MIN", "CANCELLED"];
const rows = 6;
/** Real boards carry different drums in different places: digit drums for times. */
const timeDrums = ["0123456789", "0123456789", ":", "0123456789", "0123456789"];

function pad(value: number): string { return String(value).padStart(2, "0"); }

/** Deterministic schedule from a seed so reloads look different but the board stays honest. */
function schedule(seed: number): Departure[] {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const start = new Date();
  return Array.from({ length: rows }, (_, index) => {
    const minutes = start.getHours() * 60 + start.getMinutes() + 3 + index * (4 + Math.floor(next() * 9));
    return {
      time: `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`,
      destination: destinations[Math.floor(next() * destinations.length)]!,
      platform: 1 + Math.floor(next() * 12),
      status: statuses[Math.floor(next() * statuses.length)]!,
    };
  });
}

/** Advances the board like a real one: the top row departs, everything shifts up, a new row arrives. */
function depart(board: Departure[], seed: number): Departure[] {
  const [fresh] = schedule(seed + board.length);
  const last = board.at(-1)!;
  const [h = 0, m = 0] = last.time.split(":").map(Number);
  const minutes = h * 60 + m + 4 + (seed % 9);
  return [...board.slice(1), { ...fresh!, time: `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}` }];
}

function Board() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [board, setBoard] = useState(() => schedule(seed));
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [clock, setClock] = useState(() => new Date());
  const duration = 900;
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
    // Statuses flicker between departures; the whole board shifts every few beats.
    let beat = 0;
    const timer = setInterval(() => {
      beat++;
      if (beat % 4 === 0) {
        setSeed((current) => current + 1);
        setBoard((current) => depart(current, seed + beat));
      } else {
        setBoard((current) => current.map((row, index) => index === beat % rows ? { ...row, status: statuses[(statuses.indexOf(row.status) + 1 + (beat % 3)) % statuses.length]! } : row));
      }
    }, 2600);
    return () => clearInterval(timer);
  }, [paused, seed]);
  const shared = useMemo(() => ({ duration, animated: !reduced, mode: "flap" as const, stagger: "start" as const }), [reduced]);
  return (
    <div className="site-shell board-shell">
      <a className="skip-link" href="#board">Skip to board</a>
      <header className="site-header">
        <a className="brand" href="./" aria-label="Rolling Number home"><h1>rolling number</h1></a>
        <nav aria-label="Main navigation"><a href="./">Showcase</a><a href={repository}>GitHub <span aria-hidden="true">↗</span></a></nav>
      </header>
      <main>
        <section className="board" id="board" aria-label="Departures">
          <div className="board-head">
            <span className="board-title"><RollingText {...shared} text="DEPARTURES" /></span>
            <span className="board-clock" role="timer" aria-live="off">
              <RollingNumber {...shared} stagger="outward" value={clock.getHours()} format={{ minimumIntegerDigits: 2 }} /><span className="board-colon">:</span>
              <RollingNumber {...shared} stagger="outward" value={clock.getMinutes()} format={{ minimumIntegerDigits: 2 }} /><span className="board-colon">:</span>
              <RollingNumber {...shared} stagger="outward" value={clock.getSeconds()} format={{ minimumIntegerDigits: 2 }} />
            </span>
          </div>
          <table className="board-table">
            <thead><tr><th scope="col">Time</th><th scope="col">Destination</th><th scope="col">Plat</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {board.map((row, index) => (
                <tr key={index} data-status={row.status}>
                  <td><RollingText {...shared} text={row.time} charset={timeDrums} /></td>
                  <td><RollingText {...shared} text={row.destination.padEnd(12)} /></td>
                  <td><RollingNumber {...shared} stagger="outward" value={row.platform} /></td>
                  <td><RollingText {...shared} text={row.status.padEnd(9)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="board-controls">
          <button className="mini-button" onClick={() => setPaused((current) => !current)}>{paused ? "Resume" : "Pause"}</button>
          <button className="quiet muted" onClick={() => { setSeed((current) => current + 7); setBoard((current) => depart(current, seed + 7)); }}>Next departure</button>
          <label className="board-toggle"><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />Reduce motion</label>
        </div>
        <p className="board-note">Each character is a drum of hinged cards. A change flips only the cards it travels through, forward, at a mechanical cadence, and the row sweeps from the left. Times use digit drums; destinations use letter drums. Built with <code>RollingText mode="flap"</code> from <code>@kitlangton/rolling-number</code>.</p>
      </main>
      <footer className="site-footer"><code>{"<RollingText text={destination} mode=\"flap\" stagger=\"start\" />"}</code><a href="./llms.txt">llms.txt</a><a href={`${repository}/blob/main/LICENSE`}>MIT</a></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Board /></StrictMode>);
