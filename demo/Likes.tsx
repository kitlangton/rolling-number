import { useEffect, useRef, useState } from "react";
import { RollingNumber } from "../src/react";
import { springEasing } from "./motion";

const chargeMs = 900;
export function Likes({ locale, duration, reduced, motionBlur }: { locale: string; duration: number; reduced: boolean; motionBlur: boolean }) {
  const [likes, setLikes] = useState({ value: 1204, animated: true });
  const [phase, setPhase] = useState<"idle" | "charging" | "ready">("idle");
  const [burst, setBurst] = useState(0);
  const heart = useRef<SVGSVGElement>(null);
  const started = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const effect = useRef<Animation | undefined>(undefined);
  const handled = useRef(false);
  const canAnimate = () => !reduced && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  function stop() {
    if (started.current !== undefined) handled.current = true;
    clearTimeout(timer.current); timer.current = undefined;
    effect.current?.cancel(); effect.current = undefined;
    started.current = undefined;
  }
  function cancel() { stop(); setPhase("idle"); }
  function start(animated = true) {
    if (started.current !== undefined) return;
    stop(); handled.current = false; setBurst(0); setPhase("charging");
    started.current = performance.now();
    if (animated && canAnimate() && heart.current) {
      effect.current = heart.current.animate(Array.from({ length: 31 }, (_, i) => ({
        transform: `translateX(${i % 2 ? -i / 8 : i / 8}px) rotate(${i % 2 ? -i / 12 : i / 12}deg) scale(${1 + i / 100})`,
        filter: `blur(${motionBlur ? i / 45 : 0}px)`,
      })), { duration: chargeMs, fill: "forwards" });
    }
    timer.current = setTimeout(() => {
      setPhase("ready");
      effect.current?.cancel();
      if (animated && canAnimate() && heart.current) effect.current = heart.current.animate([
        { transform: "translateX(-3px) rotate(-3deg) scale(1.3)", filter: motionBlur ? "blur(.65px)" : "none" },
        { transform: "translateX(3px) rotate(3deg) scale(1.3)", filter: motionBlur ? "blur(.65px)" : "none" },
      ], { duration: 65, iterations: Infinity, direction: "alternate" });
    }, chargeMs);
  }
  function add(amount: number, animated: boolean) {
    stop(); setPhase("idle"); setBurst(amount > 1 ? amount : 0);
    setLikes((current) => ({ value: current.value + amount, animated }));
    if (animated && heart.current) effect.current = heart.current.animate([
      { transform: `scale(${amount > 1 ? 1.4 : .72})`, filter: "blur(0px)" },
      { transform: "scale(1)", filter: "blur(0px)" },
    ], { duration, easing: springEasing(duration) });
  }
  function release(animated: boolean) {
    const since = started.current;
    if (since === undefined) return;
    handled.current = true;
    add(performance.now() - since >= chargeMs ? 200 + Math.floor(Math.random() * 301) : 1, animated);
  }
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (reduced || media.matches || document.hidden) cancel(); };
    cancel(); // Preference changes cancel the charge as well as its native effects.
    media.addEventListener("change", changed);
    document.addEventListener("visibilitychange", changed);
    return () => { stop(); media.removeEventListener("change", changed); document.removeEventListener("visibilitychange", changed); };
  }, [reduced, motionBlur]);
  return <article className="example mini-app likes-app" data-charge={phase}>
    <h2>Likes</h2>
    <div className="likes-body">
      <button className="heart" aria-label="Like" aria-describedby="like-hint"
        onPointerDown={(event) => { if (event.button === 0) { event.currentTarget.setPointerCapture(event.pointerId); start(); } }}
        onPointerUp={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) { handled.current = true; cancel(); }
          else release(canAnimate());
        }}
        onPointerCancel={() => { handled.current = true; cancel(); }}
        onLostPointerCapture={() => { if (started.current !== undefined) cancel(); }}
        onBlur={cancel}
        onKeyDown={(event) => { if (event.key === " ") { event.preventDefault(); if (!event.repeat) start(false); } if (event.key === "Escape") cancel(); }}
        onKeyUp={(event) => { if (event.key === " ") { event.preventDefault(); release(false); handled.current = false; } }}
        onClick={(event) => { if (handled.current) { handled.current = false; return; } add(1, canAnimate() && event.detail > 0); }}>
        <svg ref={heart} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z" /></svg>
      </button>
      <div className="example-number"><RollingNumber locales={locale} duration={duration} motionBlur={motionBlur} value={likes.value} animated={!reduced && likes.animated} /></div>
    </div>
    <span id="like-hint" className="mini-label centered-label" role="status">{phase === "ready" ? "Release for a SUPER LIKE" : phase === "charging" ? "Charging…" : burst ? `SUPER LIKE +${burst}` : "Tap to like. Hold for a SUPER LIKE."}</span>
  </article>;
}
