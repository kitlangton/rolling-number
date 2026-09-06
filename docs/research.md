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
Opacity uses endpoints 0 and 1 with its formatted (already clamped) samples as the
easing outputs. Clamping before interpolation preserves overshoot and blur pulses
whose first and last opacities agree. Older browsers retain explicit keyframes.
The logical trajectory sampled on interruption is unchanged. See the
[post-0.4.0 efficiency research](../perf/autoresearch.md) for the scoped ticker gain
and the native explicit-keyframe equivalence checks.
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
a Solari board. `mode: "flap"` models the mechanism instead: the current top falls
0 → -90°, then the next bottom lands 90° → 0 with a small settle. Brightness falls
off as a half-card turns away. Four clipped half-card planes now reuse that hinge:
current bottom and next top behind the moving next bottom and current top.
The slot acts as the bezel. Local `perspective(5em)` transforms avoid a shared
parent 3D scene while preserving the projection about the midline.

The first hinged implementation created two animations and two elements for every
traversed card. The current planes contain text strips that advance discretely,
with one discrete `--rn-flap-step` animation shared by all four strips and two
hinge animations. Without blur, normal glyphs need nine temporary elements and
three effects per moving slot, independent of travel. Text/keyframe data still scales with the
bounded travel. Glyphs containing line breaks use explicit row elements to keep
their positions. The step property does not require global registration: local
`steps(1, end)` holds work with its unregistered discrete animation type too.
Everything is removed on settlement. Interruption still samples the logical
wheel position from a linear motion at the card cadence and resumes from the
nearer face. Explicit `stagger` orders also sweep across in-place changes, since a
board row runs along its length; the default outward cascade still applies only to
new places so numbers keep their existing feel.

### Landing correctness and synchronized step boundaries

The initial landing easing accidentally ran 1 → 0 against 90° → 0° keyframes.
Computed transforms confirmed the lower halves started flat and ended edge-on.
The corrected easing runs 0 → 1, with a small overshoot. A browser pixel test now
holds sequence cleanup back and verifies that the landed lower half already
matches the final glyph; keyframe declarations alone did not catch this bug.

Covered-card visibility was an intermediate optimization; fixed planes replace
its visibility windows and display-support probe. Edge-on resting transforms hide
the inactive hinge without overriding an ancestor's visibility.

The index and both hinge timelines use identical normalized offsets for every
card boundary. Repeated hinge iterations plus a separate global `steps(n, end)`
index could round to different sides of an exact boundary in different engines,
showing a future face for that sample. Explicit aligned keyframes with local
`steps(1, end)` holds fix this. `flapFrames` keeps that math pure; browser tests
walk every face and test nonzero stagger holds with and without a registration API.
No JavaScript frame loop or playback layout reads are needed. This does not imply
compositor-only work: the discrete index also causes browser style/paint work.
See [the board benchmark](../perf/flap-board.md) for measured gains and dead ends.

Opt-in flap blur now uses the same vertical-only SVG kernel as reel blur, rather
than an isotropic CSS blur. Only the two turning halves receive blurred glyph
copies; complementary native opacity effects blend sharp/smeared text with the
hinge's progress and leave the landed face sharp. The blur source is clipped to
one glyph before filtering, not the whole long strip. Kernel deviation is 3.5% of
glyph height times `--rn-blur`, with zero horizontal deviation. One filter is cached
per renderer and released on blur disable, reduced motion, or destruction.

Blur adds four elements and four opacity effects per active drum, plus the shared
filter definition. This is an explicit visual-quality cost, not an optimization.
The board also has a fixed hinge shadow, including at rest.
Half-card surfaces default to opaque `Canvas`, with `--rn-flap-background` as an
override. Transparent surfaces expose the waiting glyph through the current
letter's unpainted areas. Default light/dark pixel tests cover this separately
from the board's explicitly opaque tile styling.

### Demo audio follows native drum timing

`demo/board-sound.ts` generates short noise/resonance buffers through Web Audio.
A mutation observer discovers replaced reels, then one 25 ms timer reads each
drum's logical animation time—not geometry. It groups half-card crossings into
at most two audio sources per tick, caps simultaneous voices at eight, and scales
gain sublinearly with the number of impacts. Missed impacts older than 45 ms are
dropped rather than replayed after a stall.

Audio starts only from the Sound button. Muting clears the observer, timer, drum
references, and active sources; hiding the page or reducing motion also mutes it.
Unmount closes the audio context. The audio code stays out of the library package.

### Board fields keep their physical slots

The demo now presents a fictional pull-request queue, never live GitHub data.
PR numbers use four slots; comment counts use two with a blank tens card; titles
reserve fifteen slots; statuses reserve nine. The teaser shares the title list
and capacity and cycles every five seconds, with its own timer/state. Color is
per status field: review/changes amber, approvals/merging green, CI failures red.

The clock opts into `flipDuration: 220` instead of the default 110 ms cadence at
the board's duration. Each tick therefore spends enough time visibly folded,
without slowing the queue. Minute/second tens drums contain only 0–5, and all text
drums advance forward, so `59 → 00` takes one flip per seconds slot. The clock
also uses `--rn-blur: 1.6` for a more visible vertical smear. The shared `flipDuration`
option accepts 1–10000 ms; omitting it preserves the previous cadence everywhere.

The demo applies blur selectively by default: the clock and individual review/CI
updates get vertical smear, while full-queue shifts stay sharp. Update intent comes
from React state, not DOM scans during playback. A Full-board blur checkbox retains
the heavier all-card treatment as an explicit choice. The PR benchmark compares
those policies separately; its frozen clock does not measure continuous clock ticks.

## Direct-manipulation example

The Scrub range input owns its state in a separate React component. Previously
every input rerendered the whole examples gallery, invoking formatters for unchanged
revenue, likes, invoice, and other counters. Its spring still retains velocity on
interruption, but the demo-specific duration is capped at 160 ms rather than 350 ms
to keep the response close to the pointer. Keyboard and reduced-motion input stay
static. See [the Scrub workload](../perf/scrub.md) for measured costs and limits.

Scrub uses a stronger `--rn-blur: 2.4` (previously 1.4) to make fast motion more
visible. This only increases the existing kernel's vertical deviation; the
speed-driven opacity envelope, sharp punctuation/unit suffix, 160 ms timing,
and cleanup are unchanged. No new layers or effects are added.

Native pointer testing later exposed startup starvation that the synthetic rAF
replay missed. Pending WAAPI effects could be canceled at time zero on successive
inputs. `animateNow` anchors running effects to `ownerDocument.timeline.currentTime`
so the next frame advances them before retargeting; roll, blur, and flap effects
share that anchor. Deliberately paused effects are left paused. This fixes motion
progress, not frame throughput: repeated native-pointer runs removed zero-time
replacements while rAF p95 was essentially unchanged.

## Standalone GPU flap experiment (in progress)

The PR board is no longer linked from the Rolling Number showcase and is excluded
from its default site build. `FLAP_BOARD=1 bun run build:demo` includes the standalone
page for local experimentation. Its WebGL2 renderer lives entirely under `demo/`:
one glyph atlas with cached vertical-smear channels, one instanced slot buffer,
and native-frame drawing while motion is active. Semantic HTML remains the layout
and fallback. The DOM option is retained for comparison. Initial Chromium paint
has been inspected, but cross-browser proofs and a matched GPU benchmark are
pending; do not make performance claims for this backend yet.

## Selectable values and direct text

The intact semantic value is now a transparent, selectable overlay with native
selection colors. Visual reels remain `user-select: none`. Framework adapters
select their existing semantic text and exclude the decorative mount, so a drag
copies one formatted target—not the alphabet strip or a duplicate. The overlay
does not require settlement polling or new listeners. While animating, selection
refers to the latest target rather than an intermediate wheel face.

`RollingText transition="direct"` gives every grapheme a stable position without
an alphabet wheel. On retarget, `directRoll` retains the currently visible pair,
rebases the fractional position, and appends only the newest target if necessary.
At most three glyphs remain in a direct strip. Forward inherited speed is bounded
to avoid overshooting into an old letter. New positions use the existing entrance
and stagger. Upper/lowercase and emoji are supported; bidi text stays static.
This is opt-in, preserving existing `transition="wheel"` behavior and charsets.
Direct transitions use roll mode, not flap mode.

## Demo interactions and comparisons

`/motion.html` is a noindex width/entrance tuning lab. It compares the unchanged
renderer defaults with a host-scoped internal `motionExperiments` WeakMap, not a
new public option surface. Width timing, entrance duration/hold/distance, digit
fade timing, and insertion origin are independently adjustable. Both previews
use the same value and playback-speed multiplier, with explicit replay/reversal
and opt-in looping. Reduced motion disables playback and looping. The experiment
uses the existing sampled native tracks and cleanup, without playback layout reads.
Presets are proposals to inspect, not a selected replacement for library defaults.

Fresh grouping separators now join the digit entrance hold before their short,
sharp fade. The previous rank stagger existed, but a leading comma at rank one
had no delay and faded in while the new digit was still below its mask. Existing
punctuation-role replacements retain their immediate crossfade. The lab also
orders replay after initial measurement frames rather than a 100 ms timer: delayed
first frames could otherwise adopt the expanded value as the initial static state.
The delayed-frame regression is verified in Playwright WebKit; that is not a claim
of verification in the installed Safari browser.

The main ticker exposed a separate post-settlement defect: at fractional hero
sizes, flow-stacked faces rasterized their text baselines differently from the
single resting face. The `2` and `3` moved by a device pixel when the strip was
removed. Reel faces now share a row-zero layout origin and use static translations
for row placement, preserving the same text baseline through cleanup. The reel
retains its explicit strip height for blur bounds. The main-page regression compares
endpoint/settled `1`, `2`, and `3` captures before invoking real cleanup. It bounds
both spatial drift and average pixel error: Chromium may change a few antialiased
edge samples during layer compaction without moving the glyph.

### Installed Safari: running effects are a different paint path

The endpoint-only check missed another defect in Safari 26.5 on macOS 26.5.1.
At DPR 2, a 32 px digit shifted about 2 CSS px left when its native effects became
finished, **before** our cleanup callback. At 48 px it shifted about 1.5 px left.
The DOM's horizontal coordinates did not change. Blur's extra opacity surfaces
amplified the discrepancy, but removing blur did not eliminate it at every size.
Forcing only the slot/reel layers, changing filter bounds, and preserving a face
node did not address the complete failure. Pausing the effects before capturing
their endpoints could conceal it; Playwright WebKit is not installed Safari.

Non-flap strips now wrap their faces in one `.rn-ink` paint surface with
`will-change: transform`, including at rest. Ancestor transform and blur-opacity
effects can end without changing the glyphs' compositing boundary. This adds one
surface per strip, not one per travel face; blur clones that surface only while
needed. Face/strip counts remain bounded, and finish, reduced-motion fallback,
offscreen pausing, and destruction release the surfaces with the visual columns.
The spring, blur envelope/kernel, public API, and selectable semantic layer are
unchanged. There are no extra playback effects or layout reads. Persistent paint
surfaces have a resource cost; this is not a performance improvement claim.

`tests/browser/paint-handoff.ts` supplies the same painted-ink test to Playwright
and `scripts/verify-safari.ts`. It holds effects **running** just before their
end, captures the finished state separately, then invokes real cleanup. Before
the fix, 12 of 14 installed-Safari roll cases failed a 0.1 CSS px horizontal-drift
bound. Afterward, all 28 roll/`999 → 1,000` entrance cases passed at 16, 24, 30,
32, 36, 48, and 144 px, with blur on and off; maximum measured drift was about
0.0012 CSS px. These are scoped pixel checks, not a guarantee for every browser,
font, transform, or display scale.

A separate installed-Safari capture of the actual main ticker checked `1`, `2`,
and `3`: disabling only `.rn-ink` promotion restored a 0.85–1.00 CSS px jump;
enabling it held drift below 0.003 CSS px. Manual review then confirmed that both
the hero and smaller interactions settled cleanly with motion blur enabled.

That first stabilization had a separate regression: promoting the smear's cloned
`.rn-ink` let Safari composite it outside its ancestor SVG filter. Blur was enabled
in state and computed styles but absent in the painted pixels. The smear copy now
uses `will-change: auto` so the SVG filter can rasterize its input; only the sharp
ink keeps the stable promoted surface. All 28 position checks still pass. Three
additional native checks compare the smear against an identity kernel at 16,
32, and 144 px and require genuinely softened vertical ink edges. With the bad
promotion, the screenshots were identical (edge-energy ratio 1); with the fix,
the 32 px ratio is about 0.134. Computed filter/opacity checks alone are insufficient.

The seat label now uses the same RollingNumber adapter as its price. The isolated
Likes example charges for 900 ms, shakes one bounded native effect, and awards
200–500 fictional likes on release. Pointer cancellation, blur, Escape, visibility
changes, and cleanup cancel pending charge work. Keyboard input and reduced motion
retain functionality without shake or rolling.

The weather example colors by signed temperature change, independently of the
engine's magnitude-based wheel trend: cooling from −4.5 to −9.5 is blue even
though the digit wheel advances upward. This also preserves the feedback for
keyboard and reduced-motion updates. The install command is centered as a whole
while package-manager changes animate its width.

### Production React package verification

Issue #2 exposed a gap in the packed-consumer checks: Bun's package build emitted
`react/jsx-dev-runtime`, and development-mode consumers passed while production
React crashed. The build now explicitly sets `jsx.development: false`. Package
verification renders both React components in clean React 18/19 consumers with Node and
`NODE_ENV=production`, and rejects a packed React entry containing the development
JSX runtime. Development rendering, types, Solid, CSS exports, and the React
client boundary remain covered by the same packed-artifact checks.

`/benchmarks.html` is a noindex, unlisted React comparison page. It runs one
renderer at a time with no blur, fixed input sequence, seven rounds, one warmup,
and rotating/reversed order. It includes NumberFlow React 0.6.2, React Animated
Numbers 1.1.1, and React CountUp 6.5.3 through their public APIs. CountUp interpolates
values rather than rolling glyphs and is explicitly labeled non-equivalent.
Its wall-time/rAF/element metrics are not CDP task time or presented FPS. Rendering
errors, cancellation, and hidden pages invalidate the active sample. It does not
claim automated pixel equivalence; visual correctness still needs inspection.
