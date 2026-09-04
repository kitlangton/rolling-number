import { useEffect, useId, useRef, useState } from "react";
import "./eyes.css";

/** A decorative, native-animation loop. No timers or frame-by-frame React work. */
export function Eyes({ reduced = false }: { reduced?: boolean }) {
  const id = useId().replace(/:/gu, "");
  const element = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const sync = () => setPaused(media.matches || document.hidden || !visible);
    const observer = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; sync(); })
      : undefined;
    if (element.current) observer?.observe(element.current);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <svg ref={element} className="eyes" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" data-paused={paused || reduced}>
      <defs>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="0 1.1" />
        </filter>
        {[3, 19].map((x, index) => <clipPath id={`${id}-clip-${index}`} key={x}><rect x={x + 1} y="4" width="8" height="24" rx="4" /></clipPath>)}
      </defs>
      {[3, 19].map((x, index) => {
        const digits = index === 0 ? ["0", "2", "7", "1", "4", "8", "3"] : ["1", "9", "3", "8", "2", "6", "9"];
        const glyphs = <>
          <g className="eye-look"><circle cx={x + 5} cy="16" r="1.8" fill="currentColor" /></g>
          {digits.map((digit, row) => (
            <text key={row} x={x + 5} y={16 + (row + 1) * 26} textAnchor="middle" dominantBaseline="central" fill="currentColor" className="eye-digit">{digit}</text>
          ))}
          <g className="eye-look"><circle cx={x + 5} cy={16 + (digits.length + 1) * 26} r="1.8" fill="currentColor" /></g>
        </>;
        return (
          <g key={x} className={`eye-shell ${index === 0 ? "eye-left" : "eye-right"}`}>
            <rect x={x} y="3" width="10" height="26" rx="5" stroke="currentColor" strokeWidth="1.8" />
            <g clipPath={`url(#${id}-clip-${index})`}>
              <g className="eye-reel eye-smear" filter={`url(#${id}-blur)`}>{glyphs}</g>
              <g className="eye-reel eye-sharp">{glyphs}</g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
