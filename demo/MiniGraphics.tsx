// Every graphic is a thin monochrome line drawing in `currentColor`, so the tiles
// share one quiet weight and the numbers stay the only high-contrast element.
const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function ShirtGraphic() {
  return <svg viewBox="0 0 120 120" className="shirt-graphic" aria-hidden="true" {...line}>
    <path d="M45 18 27 23 10 43 28 59 37 50v53h46V50l9 9 18-16-17-20-18-5c-1 16-29 16-30 0Z" />
    <path d="M48 18c2 10 22 10 24 0" />
    <path d="M37 50l-3-19m49 19 3-19" opacity=".5" />
  </svg>;
}

export function FileGraphic({ video = false }: { video?: boolean }) {
  return <svg viewBox="0 0 96 112" className="file-graphic" aria-hidden="true" {...line}>
    <path d="M20 9h39l20 20v72H20Z" />
    <path d="M59 9v20h20" />
    {video ? <path d="m43 47 18 11-18 11Z" /> : <path d="M34 50h28M34 62h28M34 74h18" />}
  </svg>;
}

export function WeatherGraphic() {
  return <svg viewBox="0 0 120 110" className="weather-graphic" aria-hidden="true" {...line}>
    <path d="M33 73a16 16 0 0 1-1-32 23 23 0 0 1 43-6 19 19 0 1 1 10 38Z" />
    <path d="m42 84-3 8m22-8-3 8m22-8-3 8" opacity=".6" />
  </svg>;
}

export function LedgerGraphic() {
  return <svg viewBox="0 0 240 80" className="ledger-graphic" aria-hidden="true" {...line}>
    <path d="M66 40h28m52 0h28" opacity=".5" />
    {[14, 94, 174].map((x, index) => <g key={x} opacity={index === 2 ? 1 : .55}>
      <rect x={x} y="14" width="52" height="52" rx="8" />
      <path d={`M${x + 14} 33h24m-24 9h24m-24 9h14`} />
    </g>)}
  </svg>;
}

export function AvatarGraphic() {
  return <svg viewBox="0 0 32 32" aria-hidden="true" {...line}><circle cx="16" cy="12" r="4.5" /><path d="M7 28a9 9 0 0 1 18 0" /></svg>;
}

export function ActivityGraphic({ active, animated }: { active: boolean; animated: boolean }) {
  return <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="activity-graphic" data-animated={animated} aria-hidden="true">
    <path d="M0 76h240" stroke="currentColor" opacity=".35" />
    {[20, 32, 25, 46, 38, 60, 72].map((height, index) => <rect key={index} x={7 + index * 33} y={76 - height} width="18" height={height} rx="2" fill="currentColor" opacity={index === 6 ? 1 : .3} style={{ transform: `scaleY(${active ? 1 : .45})` }} />)}
  </svg>;
}
