# Rolling Number

**Numbers that move without losing their place.**

A small, original TypeScript library for interruptible rolling numbers. Native
browser animation playback, a framework-independent DOM API, and a thin React
adapter. MIT licensed. No runtime dependencies in the DOM core.

> Initial development version. **Not published to npm yet.** The package name is
> `@kitlangton/rolling-number`; the unscoped name belongs to another project.

## Try it

```sh
git clone https://github.com/kitlangton/rolling-number.git
cd rolling-number
bun install
bun run dev
```

The demo includes rapid reversals, prices, large integers, typography controls,
locale changes and reduced motion. Nothing needs a remote font or an API key.

## React

```tsx
import { RollingNumber } from '@kitlangton/rolling-number/react'
import '@kitlangton/rolling-number/styles.css'

<RollingNumber
  value={1234.56}
  locales="en-US"
  format={{ style: 'currency', currency: 'USD' }}
  duration={500}
/>
```

React owns the accessible formatted text; the engine owns a separate decorative
mount. There are no per-frame React state updates. Server rendering produces
readable text and the initial hydration does not animate. Use identical initial
values, locales and options on the server and client; differing ICU/CLDR versions
can still produce different formatted text. Hydration warnings are not suppressed.

React 18 and 19 are supported. React is an optional peer dependency; vanilla users
do not need to install it. The React entrypoint preserves its `use client` boundary.

## Vanilla DOM

```ts
import { createRollingNumber } from '@kitlangton/rolling-number'
import '@kitlangton/rolling-number/styles.css'

const counter = createRollingNumber(document.querySelector('#balance')!, {
  value: 1234.56,
  locales: 'en-US',
  format: { style: 'currency', currency: 'USD' },
})

counter.update({ value: 1300 })
counter.refresh() // Explicit refresh after a theme or variable-font change
counter.finish()  // Immediately show the latest target
counter.destroy() // Releases resources; leaves the final formatted text
```

The controller owns the host's children until destruction. `destroy()` is
idempotent. Invalid values/options throw before replacing the current display.

### Options

| Option | Default | Behavior |
| --- | --- | --- |
| `value` | required | `number` or `bigint`; never parsed from display text |
| `locales` | browser default | Locale(s) passed to `Intl.NumberFormat` |
| `format` | `{}` | Native `Intl.NumberFormatOptions` |
| `duration` | `500` | Milliseconds; `0` disables motion; maximum `10000` |
| `animated` | `true` | `false` immediately settles the latest value |
| `direction` | `"auto"` | `"auto"`, `"up"`, or `"down"` |
| `pauseOffscreen` | `true` | Offscreen counters keep the latest text without rolling |

Auto direction follows **displayed magnitude**: `-12 → -11` rolls `12 → 11`, with
the sign handled separately. Large jumps have bounded travel; the renderer does
not enumerate every intervening numerical value. Unchanged formatted values do
not restart animations.

The React component additionally accepts ordinary span attributes, including
`className`, `style`, `aria-label`, and an element ref. It does not accept children
or raw HTML. For rapidly repeated keyboard input, set `animated={false}` for that
update rather than making the interface chase each keypress.

## How it stays small and stable

- **One numeral per digit at rest.** During a roll, only a bounded travel strip
  exists; completion returns to one face. Huge value changes do not create huge reels.
- **Native playback.** Critically damped spring trajectories are sampled once into
  direct transform keyframes. No JavaScript animation-frame loop runs during playback.
- **Interruptions replace, not accumulate.** A new target samples the current
  position and velocity; each property has one owning animation.
- **Batched geometry.** Across counters, reads happen before animation writes.
  ResizeObserver tracks intrinsic boxes and individual glyph sizes; font-loading
  events and `refresh()` handle further invalidation.
- **Readable by default.** Reduced motion, unsupported animation APIs, offscreen
  state, and non-rollable formats retain an intact formatted text value.

### Typography and layout contract

Fonts, size, weight, style and spacing are inherited. Proportional numerals work;
`font-variant-numeric: tabular-nums` is optional, not a measurement substitute.

**The host adopts its target intrinsic width immediately; internal glyphs glide
to their target positions.** This does not animate arbitrary surrounding siblings
or promise zero layout shift. Reserve space with CSS `min-width` when a stable
surrounding layout matters. Ancestor axis-aligned scaling is supported; rotated or
skewed ancestors, vertical writing and per-digit typography are not a v0.1 contract.

### Locale and accessibility boundaries

All values use native Intl formatting, including bigint, negative zero, accounting
signs, percentages and alternate grouping. **Rolling currently targets standard
Latin-digit formats.** RTL scripts, non-Latin digits, compact/scientific/engineering
notation, NaN and infinity render as intact static localized text. They are not
silently transliterated or forced into LTR layout.

Assistive technology receives one formatted value; decorative glyphs are hidden.
There is no default live region. Applications can opt into `aria-live="polite"`
and `aria-atomic="true"` for a deliberately paced announcement. Reduced-motion
changes settle active animations immediately.

## Performance, without the superlatives

NumberFlow is the inspiration and the comparison target, not copied source.
The benchmark pins **NumberFlow 0.6.2**, measures production code, includes a
plain-text floor, counts shadow-DOM elements, and reports repeated measurements.

```sh
bun run bench
```

See [the methodology](perf/method.md) and [research and design tradeoffs](docs/research.md).
Benchmarks are workload- and browser-specific. A smaller DOM or no per-frame
JavaScript does not, on its own, prove smoother presented frames or universal speed.

## Development

```sh
bun run check
bunx playwright install chromium firefox webkit
bun run test:browser
bun run build:demo
```

Tests cover formatting, exact bigint handling, interruption continuity, bounded
cleanup, proportional fonts, reduced motion, hidden → visible transitions, and
React hydration under StrictMode in Chromium, Firefox and WebKit.

`dist/` contains ESM and declarations plus an explicit stylesheet. There is no
automatic global style injection, custom-element registration, or server-side DOM
access. See [LICENSE](LICENSE).
