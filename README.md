# Rolling Number

**Numbers that move without losing their place.**

A small, original TypeScript library for interruptible rolling numbers. Native
browser animation playback, a framework-independent DOM API, and thin React and
Solid adapters. MIT licensed. No runtime dependencies in the DOM core.

## Install

```sh
bun add @kitlangton/rolling-number
```

Or use `npm install @kitlangton/rolling-number`. The unscoped name belongs to
another project. Import the stylesheet alongside either the DOM or React entrypoint.

## Try it

```sh
git clone https://github.com/kitlangton/rolling-number.git
cd rolling-number
bun install
bun run dev
```

The main number shows elapsed milliseconds since opening the page. The demo also
includes prices, large integers, typography controls, locale changes and reduced
motion. Nothing needs a remote font or an API key.

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

## Solid

```tsx
import { createSignal } from 'solid-js'
import { RollingNumber } from '@kitlangton/rolling-number/solid'
import '@kitlangton/rolling-number/styles.css'

function Balance() {
  const [value, setValue] = createSignal(1234.56)
  return <RollingNumber value={value()} locales="en-US" format={{ style: 'currency', currency: 'USD' }} />
}
```

Solid 1.9+ is supported. Pass reactive props normally; the adapter forwards changes
to the same DOM controller and destroys it on cleanup. Use Solid's `class` and
`ref` props. Server rendering keeps readable text, and hydration adopts it without
an initial roll. React and Solid are optional peers; each adapter imports only its
own framework. The shipped Solid entry works in browser and server builds without
a package-specific JSX transform.

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
| `motionBlur` | `false` | Opt-in, speed-driven vertical blur on rolling digits |
| `direction` | `"auto"` | `"auto"`, `"up"`, or `"down"` |
| `pauseOffscreen` | `true` | Offscreen counters keep the latest text without rolling |

Auto direction follows **displayed magnitude**: `-12 → -11` rolls `12 → 11`, with
the sign handled separately. Large jumps have bounded travel; the renderer does
not enumerate every intervening numerical value. Unchanged formatted values do
not restart animations.

The React component additionally accepts ordinary span attributes, including
`className`, `style`, `aria-label`, and an element ref. It does not accept children
or raw HTML. Set `animated={false}` for updates that should settle immediately.
Changes between supported formats animate digits, separators and symbols while
respecting reduced-motion preferences.

For prominent counters, opt into `motionBlur`. Fast reels crossfade into a vertical
SVG blur, then sharpen as they slow down. Stable digits and punctuation stay sharp.
The temporary duplicate reel and native opacity effects are removed on settlement;
disabling the option clears active blur immediately. This adds paint/DOM work and
is not a performance optimization. The showcase and examples enable it; library
counters default to no blur. Reduced motion disables the effect along with rolling.
New glyphs can also smear vertically during their eased entrance; the blend clears
at settlement.
See [the scoped blur-cost measurement](perf/blur-cost.md) for its overhead and limits.

## How it stays small and stable

- **One numeral per digit at rest.** During a roll, only a bounded travel strip
  exists; completion returns to one face. Huge value changes do not create huge reels.
- **Native playback.** Critically damped spring trajectories are sampled once into
  a `linear()` easing between two direct transform keyframes where supported.
  Explicit sampled keyframes remain the compatibility fallback. No JavaScript
  animation-frame loop runs during playback.
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

Digit viewports have a linear alpha fade at their top and bottom edges. Tune it
without changing the measurement or animation:

```css
.counter { --rn-edge-fade: 0.12em; } /* default */
.counter--hard-clip { --rn-mask: none; } /* opt out of masking */
```

**The host adopts its target intrinsic width immediately; internal glyphs glide
to their target positions.** The renderer captures the previous and next origins
in shared measurement batches, keeping existing glyphs continuous in left-, center-
and right-aligned layouts. New glyphs rise from below after space starts opening.
This does not animate arbitrary surrounding siblings
or promise zero layout shift. Reserve space with CSS `min-width` when a stable
surrounding layout matters. Ancestor axis-aligned scaling is supported; rotated or
skewed ancestors, vertical writing and per-digit typography are not a v0.1 contract.

### Locale and accessibility boundaries

All values use native Intl formatting, including bigint, negative zero, accounting
signs, percentages and alternate grouping. **Rolling currently targets standard
Latin-digit formats in LTR layout.** RTL surroundings/scripts, non-Latin digits, compact/scientific/engineering
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

The [published local comparison](perf/results.md) of commit `35155ca` measured
**59.2% less main-thread work and 56.7% fewer retained elements** than NumberFlow
0.6.2 for 100 animated counters in Chromium 151 on an Apple M2 Max. This baseline
predates format-to-format transitions and the Solid adapter. It includes the
slower cases, methodology and raw per-round data—not a
claim that every workload or browser is faster.

## Development

```sh
bun run check
bunx playwright install chromium firefox webkit
bun run test:browser
bun run build:demo
```

Tests cover formatting, exact bigint handling, interruption continuity, bounded
cleanup, proportional fonts, reduced motion, hidden → visible transitions, and
React hydration under StrictMode and Solid hydration/reactive cleanup in Chromium,
Firefox and WebKit.

The dark-only demo keeps the showcase and four interactive examples up front.
Its eye mark uses synchronized gaze and a paired jackpot roll with vertical SVG blur,
and stops for reduced motion, hidden documents and offscreen state.

`dist/` contains ESM and declarations plus an explicit stylesheet. There is no
automatic global style injection, custom-element registration, or server-side DOM
access. See [LICENSE](LICENSE).

### Website deployment

`bun run deploy` builds the showcase and benchmark, then deploys static assets to
Cloudflare Workers at [rolling.kitlangton.dev](https://rolling.kitlangton.dev).
Wrangler uses the operator's Cloudflare login; no credentials belong in the repo.
