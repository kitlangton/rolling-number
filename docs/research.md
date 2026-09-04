# Rendering research — September 2026

The reference is **NumberFlow 0.6.2**, not an older release. This is an original
implementation, not a fork. NumberFlow is MIT licensed; it remains a development
dependency for comparisons, not a runtime dependency or copied implementation.

## Findings

- NumberFlow already handles interruptible transitions, proportional numerals,
  reduced motion, SSR, and hidden-document updates. Its current version fixes
  several older reflow and hidden-tab issues. Those are not fair claims against
  the current release.
- Its normal digit has a wrapper and ten resident numeral spans. It measures
  character geometry before and after updates and uses accumulated WAAPI effects
  and animated custom properties. The maintainer describes a Chromium compositing
  tradeoff in [issue 183](https://github.com/barvian/number-flow/issues/183).
- `Intl.NumberFormat.formatToParts` must own rounding, grouping, signs, currency,
  percent and localized text. Stable identities come from digit places, never
  string indices. Bigints must not pass through Number.
- Flex-splitting Arabic/Persian strings is not equivalent to native bidi text.
  Preserve an intact formatted fallback for unsupported animated scripts and
  scientific/engineering/compact notation. Correct text is better than wrong motion.
- React should own semantic text and an empty decorative mount; imperative
  animation owns only the mount's descendants. Do not render animation frames
  through React state or hide hydration mismatches.

## Initial experiments

1. Keep one numeral at rest; generate only a bounded travel strip during a roll.
2. Cache previous geometry and batch next-geometry reads across instances in one
   frame, then write animations. No layout reads during playback.
3. Use ordinary transform/opacity WAAPI keyframes rather than animated CSS custom
   properties or an animation-frame physics loop. Precompute a spring trajectory;
   sample its current position and velocity when interrupted and replace the old
   animation instead of accumulating effects.
4. Track intrinsic geometry with ResizeObserver and font-loading notifications.
   Keep the accessible string separate and stop motion immediately for reduced
   motion or document visibility changes.

These are testable hypotheses, not performance results. See `perf/method.md`.
## Why HTML, not SVG or canvas?

SVG text requires explicit viewport sizing and font/baseline/coordinate management.
`foreignObject` retains HTML layout costs and adds an SVG embedding boundary. Canvas
needs per-frame redraws, manual typography/DPR handling and a parallel accessible
representation. None is inherently faster for an inline number. We chose inherited
HTML typography and direct WAAPI transforms; SVG/canvas remain experiments, not
unimplemented promised features.

The hybrid spring stores the exact sampled trajectory used by WAAPI and samples
position/velocity at interruption. It avoids custom-property animation and a
JavaScript frame loop; that is not a universal guarantee of compositor-only work.
The compact path uses two transform endpoints with a sampled `linear()` easing.
Opacity retains explicit samples because clamping its overshoot is non-linear;
interpolating two clamped endpoints would change the trajectory.
Reel viewports now use a simple top/bottom linear alpha mask for softer entry and
exit edges. `--rn-edge-fade` controls its extent; `--rn-mask: none` retains hard
clipping. The current benchmark includes the mask rather than reusing the initial
unmasked measurements. This is a visual tradeoff, not a claim that masks are free.
Real width is adopted during the scheduled measurement batch. Each batch reads
the old origins, writes measurement tokens, reads target geometry, then starts
native playback. This compensates for centering/right-alignment changes without
reading layout during playback. New glyphs share retained insertion edges and
rise through their masks after horizontal space starts opening. A temporary entry
wrapper is removed on completion or cleanup. Arbitrary surrounding inline siblings
do **not** continuously reflow without layout work.

ResizeObserver tracks intrinsic measurement boxes and individual tokens, not a
fixed-width host. Font events and an explicit `refresh()` handle additional
invalidation. Ancestor axis-aligned scale is normalized during geometry reads;
rotated/skewed ancestors and vertical writing are not part of the v0.1 contract.

The review also found and regression-tested scheduled-update/ResizeObserver
ordering, geometry recovery with offscreen pausing disabled, native-text fallback
under inherited RTL layout, and React 19 callback-ref cleanup. Fast playback must
not come from accidentally cancelling the animations being measured.

New `text-box-trim` (Baseline August 2026) is useful for optical spacing, not a
replacement for font metrics. `interpolate-size` is not yet broadly supported and
does not make intrinsic width animation free of layout. Neither is required.

## Framework boundaries and format changes

React and Solid both own readable semantic text and a separate decorative mount.
They delegate animation, measurement and lifecycle cleanup to `createRollingNumber`.
Solid's adapter uses its native `Dynamic` primitive so one prebuilt entry supports
client rendering and SSR without shipping uncompiled JSX or importing React.

Supported format changes retain digit-place identities. Non-digit token keys also
include their text, while a separate identity retains the symbol's role. Replacements
crossfade at that role's previous horizontal position instead of entering from the
next digit's insertion edge. Unsupported formats still settle to intact native text.

## Optional hero blur

`motionBlur` defaults to false. For opted-in rolling digits, a sampled speed
envelope crossfades sharp and vertically blurred copies under the same reel
transform. A static SVG Gaussian kernel uses zero horizontal deviation; native
opacity playback controls the blend without a JavaScript frame loop. Copies and
effects are bounded to one pair per moving reel and removed at settlement.
Digit entrances use a delayed critically damped ease-out: horizontal room opens first,
then the glyph rises decisively and settles gently. Their blur envelope uses
vertical speed in rows/second with a lower onset than full digit rolls. If a new
roll interrupts an entrance, it takes over blur ownership so the older entry's
cleanup cannot cancel the new blend.

The demo's `/ month` text is deliberately outside the numeric formatter. A scoped
ResizeObserver supplies its number-box width delta to the same sampled spring;
native translation preserves the suffix's screen position during width changes
and reversals. This is explicit demo layout coordination, not a promise that the
core automatically animates arbitrary siblings.

## Subtler symbol motion: reference check

- NumberFlow's documentation separates digit spin, layout transforms and opacity
  timing. A public-API runtime probe of installed NumberFlow **0.6.2**, changing USD
  to GBP at a fixed value, found opacity animations on the `$` and `£` nodes, not
  vertical roll animations. The probe used our configured benchmark timings; it
  was not a measurement of NumberFlow's default durations or a source-code port.
- Apple's `numericText(value:)` documentation describes a transition for numeric
  text, with the value difference determining direction. It does not specify an
  exact currency-symbol transition or spring curve. Apple's Motion HIG calls for
  purposeful, brief, precise feedback, restrained frequent motion, and cancellation.
- Our refinement: digits retain rolling and optional blur; non-digit symbols use
  a short crossfade (up to 180 ms) and never get a vertical entry wrapper. Replacement
  currency/sign glyphs share a role anchor, while the existing layout spring continues
  to preserve surrounding digit positions. This is an original design informed by
  those references, not a claim of pixel-identical iOS animation.

Replacement symbols also scale subtly from 96% to 100%; the outgoing symbol grows
from its current scale toward 104% as it fades. These transforms stay on the glyph
reel and do not resize the measurement box or scale numeric digits.
Symbols no longer need vertical reel masks, so their entire glyph stays visible
during the crossfade and scale accent. Only numeric reels retain the edge masks.

The demo's outer number containers must not be horizontal scrollports. A shrinking
price can still have visible digits beyond its new intrinsic width. The regression
test samples an actual painted pixel inside such a digit, then reapplies the old
scrollport styles as a negative control. Bento tiles remain overflow-visible too.
Reel viewports use vertical-only clipping where supported, with the previous
per-slot clipping as a legacy CSS fallback; soft top/bottom masks are preserved.

The elapsed-millisecond demo samples at 33 ms rather than 100 ms. The previous
cadence aliased the tens/ones places into nearly constant values. The counter still
uses actual elapsed time, not invented trailing digits. See [the ticker experiment](../perf/ticker.md)
for a rejected geometry-cache optimization; fewer explicit reads did not improve
measured task time in that run.

## Sources

- [NumberFlow documentation](https://number-flow.barvian.me/)
- [NumberFlow 0.6.2 release](https://github.com/barvian/number-flow/releases/tag/number-flow%400.6.2)
- [NumberFlow non-Latin digits](https://github.com/barvian/number-flow/issues/8)
- [NumberFlow RTL](https://github.com/barvian/number-flow/issues/93)
- [Intl formatToParts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/formatToParts)
- [Intl number formatting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)
- [React hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)
- [React StrictMode](https://react.dev/reference/react/StrictMode)
- [WAAPI cancel](https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel)
- [High-performance animations](https://web.dev/articles/animations-guide)
- [ResizeObserver specification](https://drafts.csswg.org/resize-observer/)
- [CSS linear and interruption](https://www.joshwcomeau.com/animation/linear-timing-function/)
- [Safari 26.4 SVG fixes](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/#svg)
- [text-box-trim](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box-trim)
- [SVG Gaussian blur](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feGaussianBlur)
- [Apple numericText(value:)](https://developer.apple.com/documentation/swiftui/contenttransition/numerictext(value:))
- [Apple Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion)
- [NumberFlow timing controls](https://number-flow.barvian.me/#timings)

New places are staggered rather than revealed together. `entryRanks` orders fresh
tokens by distance from the nearest retained digit (retained symbols such as a
currency sign do not anchor the cascade), and `delayed` prepends a hold to the
sampled entrance and fade motions so the browser still plays one native effect per
property. The step is capped at 4.5% of the duration and the whole cascade at 30%,
sized only by fresh tokens. A place still inside its hold is fully transparent, so a
reversal removes it immediately instead of fading a glyph that never appeared.

Agent access follows the llms.txt convention plus Markdown content negotiation:
`scripts/agent-docs.ts` emits `index.md`, `llms.txt` and `_headers` from the README
at build time, and `worker.ts` answers `Accept: text/markdown` on the page with the
Markdown, advertising it through a `Link: rel="alternate"` header and a matching
`<link>` element for agents that only parse HTML. Nothing on the site is generated
from a second source of truth.

## Text wheels

`RollingText` reuses the digit machinery unchanged: `Token.wheel` and `Token.index`
replace the numeric `digit`, `face(wheel, position)` replaces `numeral`, and
`rollTarget` takes the wheel size. Character position is the token identity, so a
word retargets in place and length changes use the existing layout spring. The
text source reports a constant upward trend, matching physical split-flap boards
which only advance; a 44-glyph default charset means a single change can travel up
to 43 faces, which is the intended look and stays bounded per slot. Graphemes are
segmented with `Intl.Segmenter` when available. Bidi text stays static, as with
numbers.

`stagger` exposes the existing cascade with explicit orders; `data-rn-trend` and
`--rn-blur` expose state the renderer already had, read only at measurement time.

## Split-flap mode

The first board demo glided letters through a reel, which reads as an odometer, not
a Solari board. `mode: "flap"` models the mechanism instead: each step is one card
hinged at the midline, built from two absolutely positioned half-face copies (the
top half of the current face falls 0 → -90°, then the bottom half of the next face
lands 90° → 0 with a small settle), with brightness falling off as a card turns
away. Paint order is DOM order: landed bottoms stack upward, waiting tops stack
downward, so the current face always paints last without 3D sorting. The slot's
existing vertical clip acts as the bezel. A reference implementation
(daformat/react-split-flap-display) renders the entire drum for every slot as
permanent 3D flaps; here only the cards a change travels through exist, bounded by
one revolution, and they are removed on settle. Interruption samples the logical
wheel position from a linear motion at the card cadence and resumes from the
nearer face. Explicit `stagger` orders also sweep across in-place changes, since a
board row runs along its length; the default outward cascade still applies only to
new places so numbers keep their existing feel.
