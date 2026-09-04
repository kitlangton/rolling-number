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
Real width is adopted at update time, while glyph positions animate. Arbitrary
surrounding inline siblings do **not** continuously reflow without layout work.

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
