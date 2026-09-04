export function ShirtGraphic() {
  return <svg viewBox="0 0 120 120" className="shirt-graphic" aria-hidden="true">
    <path d="M45 18 27 23 10 43 28 59 37 50v53h46V50l9 9 18-16-17-20-18-5c-1 16-29 16-30 0Z" fill="#292d33" stroke="#626871" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M37 50l-3-19m49 19 3-19M40 98h40" fill="none" stroke="#4b515a" strokeWidth="1.5" />
    <path d="M48 18c2 10 22 10 24 0" fill="none" stroke="#858b94" strokeWidth="2" />
    <rect x="69" y="60" width="8" height="3" rx="1" fill="#f08062" />
  </svg>;
}

export function FileGraphic({ video = false }: { video?: boolean }) {
  return <svg viewBox="0 0 96 112" className="file-graphic" aria-hidden="true">
    <path d="M20 9h39l20 20v72H20Z" fill="#22262c" stroke="#616771" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M59 9v20h20" fill="none" stroke="#616771" strokeWidth="1.5" />
    {video ? <><rect x="33" y="43" width="34" height="29" rx="5" fill="#353b44" /><path d="m47 50 12 8-12 8Z" fill="#c8cdd4" /></> : <><path d="M32 43h17m-17 12h35m-35 9h35m-35 9h21" stroke="#69717c" strokeWidth="2" strokeLinecap="round" /><path d="M32 89h35" stroke="#f08062" strokeWidth="2" strokeLinecap="round" /></>}
  </svg>;
}

export function WeatherGraphic() {
  return <svg viewBox="0 0 120 110" className="weather-graphic" aria-hidden="true">
    <circle cx="78" cy="33" r="16" fill="#d7bf8e" />
    <path d="M78 7V2m26 31h5M96 15l4-4M60 15l-4-4" stroke="#d7bf8e" strokeWidth="2" strokeLinecap="round" />
    <path d="M33 73a16 16 0 0 1-1-32 23 23 0 0 1 43-6 19 19 0 1 1 10 38Z" fill="#30363f" stroke="#727b87" strokeWidth="1.5" />
    <path d="m42 84-3 8m22-8-3 8m22-8-3 8" stroke="#8eafc2" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

export function LedgerGraphic() {
  return <svg viewBox="0 0 240 80" className="ledger-graphic" aria-hidden="true">
    <path d="M54 40h132" stroke="#424850" strokeWidth="1.5" />
    {[14, 94, 174].map((x, index) => <g key={x}>
      <rect x={x} y="14" width="52" height="52" rx="6" fill="#1b1e23" stroke={index === 2 ? "#b16d58" : "#3c424a"} />
      <path d={`M${x + 12} 33h20m-20 8h28m-28 8h16`} stroke="#656e79" strokeWidth="2" strokeLinecap="round" />
      <circle cx={x + 40} cy="24" r="2" fill={index === 2 ? "#f08062" : "#656e79"} />
    </g>)}
  </svg>;
}

export function AvatarGraphic() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="12" r="5" fill="currentColor" /><path d="M6 29a10 10 0 0 1 20 0" fill="currentColor" /></svg>;
}

export function ActivityGraphic({ active, animated }: { active: boolean; animated: boolean }) {
  return <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="activity-graphic" data-animated={animated} aria-hidden="true">
    <path d="M0 76h240" stroke="#363b42" />
    {[20, 32, 25, 46, 38, 60, 72].map((height, index) => <rect key={index} x={7 + index * 33} y={76 - height} width="18" height={height} rx="2" fill={index === 6 ? "#f08062" : "#39414b"} style={{ transform: `scaleY(${active ? 1 : .45})` }} />)}
  </svg>;
}
