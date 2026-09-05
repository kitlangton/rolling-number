# Flap board autoresearch — September 4, 2026

**Historical departure-board workload.** The demo now shows pull requests and uses
vertical blur selectively. See [the current PR-board measurement](pull-request-board.md).
Its dataset is intentionally incompatible with these retained baseline captures.

The second pass below replaces per-card effects with **fixed half-card strips**.
In the final seven-round comparison, the silent board used **16.7% less task time** than
the already-optimized fixed-platform baseline, with about **71% fewer elements**
and **91% fewer active effects**. Median per-round rAF p95 fell from 17.16 to 9.30 ms.
These are observations for this workload/environment, not displayed-FPS promises.

**First pass (historical):** correct the bottom-half landing, hide fully covered
cards, and retain the requested opt-in blur and demo sound. Visibility reduced median
main-thread work by about 25% in the native-timer workload below. Blur and sound
have measured costs; neither is presented as a speed optimization.

## Target and workload

Reduce renderer main-thread work for the actual six-row React departure board
without skipping faces, dropping the row sweep, or breaking interruption/cleanup.

`scripts/bench-board.ts` builds into an isolated temporary directory. Each sample
uses a fixed random seed and Date (native timers/performance remain untouched),
pauses automatic departures, shifts the board twice with a 350 ms interruption,
then allows 6000 ms of natural settlement. Requested duration is the demo's 900 ms;
card cadence is capped at 110 ms. Viewport: 1440 × 1000, DPR 1, UTC, en-US.

Primary metric: Chromium CDP TaskDuration during both updates through settlement.
Secondary: style/layout work, rAF p95 intervals, active DOM/effects. Active DOM
snapshots and the rAF observer are inside the window; final settled text/geometry
verification and explicit garbage collection are outside. rAF is not presented FPS.

One warmup and seven measured rounds by default. `BENCH_BASELINE` compares a
retained baseline and candidate production build in the same browser invocation.
This is a same-library comparison, not a NumberFlow comparison (NumberFlow is not
a split-flap implementation). The visible local demo was open at the user's request;
timing remains environment-specific, with unrelated browser load a limitation.

```sh
BENCH_KEEP_BUILD=1 BENCH_OUTPUT=perf/flap-board-before.local.json bun run scripts/bench-board.ts
BENCH_BASELINE=perf/flap-board-before.local.json BENCH_OUTPUT=perf/flap-board-after.local.json bun run scripts/bench-board.ts
BENCH_SOUND=1 BENCH_OUTPUT=perf/flap-board-sound.local.json bun run scripts/bench-board.ts
```

Use `BENCH_TMPDIR` to choose the temporary parent. Retained builds intentionally
survive for comparisons; ordinary candidate builds are removed in `finally`.
`BENCH_ANIMATED=0` measures a separate static-board workload. A shorter smoke can
use `BENCH_ROUNDS=1`, but is not performance evidence.
`BENCH_REFERENCE` adds another retained build. `BENCH_SOUND=1` compares sound on
and off using the same current build; context creation and initial synthesis are
outside the measured window. Audio-source creation/playback during the sweep is
inside it. CDP task time does not measure total audio-thread or GPU work.

## Rejected clock-assisted captures

Working tree based on `9611276`, including the already-present shared-path cleanup.
Source SHA-256: `4333f8079b37a97f6bcb521e58561ff6ad361d5a08a35d21c0a5c13b22b0ad70`.
`src/flap.ts` SHA-256: `a83c2267bc5e160cabb1757cdce819623b5ea85e504fdaa01d3197978780cd01`.

Apple M2 Max, macOS arm64 (Darwin 25.5.0), Bun 1.4.0, headless Chromium
151.0.7922.34. Production build, 1 warmup + 7 measured rounds.

The initial `flap-board-before.local.json` reported 4739.27 ms task median, but
**do not use this result**. Playwright's fixed clock wrapped timer/rAF scheduling
while WAAPI remained native. Follow-up runs reached the settlement assertion with
logical reel tracks still running, despite the apparent 6000 ms wait.

Benchmark v3 overrides only `Date` and leaves native timers, rAF, and performance
time untouched. It also flushes two frames after the wait for native finish events.
Earlier `before`, `landing`, and `corrected` JSON timings are invalid evidence.
Their retained production assets remain usable: comparisons re-run those assets
under the current harness rather than pooling earlier measurements.

## Experiment 1: correct the landing easing

The bottom keyframes go from 90° to 0°, but the `linear()` easing goes from 1 to 0.
That reverses interpolation. A native computed-style probe of the retained build
confirmed 0° at the beginning, about 86.08° halfway, and 90° at the end, with
brightness falling from 1 to .45. With backwards fill, future bottoms therefore
wait flat rather than edge-on; the final face is only restored by settlement.

Hypothesis: complement the easing stops to run 0 → 1. This restores the documented
90° → 0° landing with the small overshoot and keeps future bottom cards edge-on.
It may also reduce hidden-stack rendering work without changing faces, cadence,
stagger, keyframe count, element count, or interruption scheduling.

**Keep for correctness, not speed.** The native/pixel regression passes in
Chromium, Firefox, and WebKit. Probe: `flap-landing-before.local.json`.

## Experiment 2: hide covered cards — keep

Against the corrected landing build, expose only the top cards needed under the
current fall, and keep a landed bottom visible only until its successor covers it.
The first top and final bottom remain visible for their necessary holds. Native
visibility keyframes preserve faces, cadence, shading and row stagger.

Native-timer capture `flap-board-visibility-native.local.json`, one warmup plus
seven rounds per variant, alternating order:

| Variant | Task median | Task IQR | Task range | Median rAF p95 |
| --- | ---: | ---: | ---: | ---: |
| Corrected landing, all cards filled | 6102.09 ms | 6083.92–6154.26 | 6061.92–6374.90 | 101.24 ms |
| Covered-card visibility | 4596.20 ms | 4584.73–4659.40 | 4561.10–4698.02 | 25.00 ms |

Task work fell **24.7%**. Style work rose (117 → 731 ms), but total task work fell.
Active DOM stayed around 6200 elements: this reduces rendering work, not allocation.
Interruption samples native progress, so a faster frame can change the exact
interrupted face and retained-card count; the inputs and final text remain fixed.

Visibility source SHA-256: `eeaf20bb108c65f94f4b766af051c325642ddcd7dfaeeafaab3e3b060492261b`.
Flap SHA-256: `d3e59452bf9abcf240d2400a23a9615a4e566fbea9e4f3487473cab7ff0eecca`.

## Experiment 3: subtle blur and hinge shadow — intentional cost

Add opt-in blur to the existing brightness keyframes, sharpen on landing, and add
a fixed bezel seam. No extra animated elements or effects. `--rn-blur: 0` now
correctly means zero rather than falling through to the default intensity.

Three-way native-timer capture `flap-board-final.local.json`, one warmup plus
seven rounds per variant with rotated/reversed order:

| Variant | Task median | Task IQR | Task range | Median rAF p95 |
| --- | ---: | ---: | ---: | ---: |
| Corrected landing, all cards filled | 6191.95 ms | 6153.34–6221.41 | 5779.82–6254.53 | 142.88 ms |
| Covered-card visibility | 4682.30 ms | 4674.29–4700.57 | 4655.96–4712.49 | 25.00 ms |
| Visibility + blur + hinge | 4950.19 ms | 4866.25–4972.03 | 4772.43–4994.33 | 17.50 ms |

The visibility gain repeated (**24.4%**); requested polish added **5.7%** task work
over visibility alone. The polished board still used **20.1% less** task time than
the corrected landing baseline in this run. rAF intervals are an observation, not
a claim about displayed FPS or universal smoothness.

Polished source SHA-256: `f2dcc7c0794aef60cf8f9984cc6de38d83d9139d0fd2116fa4854501e12a43ed`.
Flap SHA-256: `8bc99deb58afe30d4b36297d1b3e0919f3c22d529b678e5b23ba7512162151b9`.

## Experiment 4: procedural audio — opt-in

Sound groups impacts from actual drum animation times, rather than allocating a
source per card or playing a prerecorded loop. First capture
`flap-board-sound.local.json`: silent task median 4934.33 ms versus sound-on
5374.28 ms, approximately 9% overhead. The simplify review found that the
two-variant order always put silent first; treat this as exploratory until the
corrected-order rerun. Audio generated 359–381 sources per two-departure sample,
not one for every half-card; all sources and flaps settled naturally.

Final benchmark v4 rotates after each forward/reverse pair, rather than rotating
every round and accidentally cancelling the reversal for two variants. Capture
`flap-board-sound-final.local.json`, one warmup plus seven rounds per variant:

| Variant | Task median | Task IQR | Task range | Median rAF p95 |
| --- | ---: | ---: | ---: | ---: |
| Polished board, sound off | 4893.50 ms | 4888.24–4901.31 | 4883.80–4916.68 | 18.26 ms |
| Same build, sound on | 5340.66 ms | 5336.78–5361.04 | 5332.01–5370.68 | 18.20 ms |

Opt-in sound adds **9.1%** measured task work. Similar rAF intervals do not make
that work free. This run generated 372–381 grouped sources per sample, with no
sources remaining after natural settlement. The simplify pass removed redundant
descendant searches, but its small timing difference from the first sound capture
is not evidence of another performance win.

Final source SHA-256: `d812524d81995aaccbe03ea8c8fadebe0f2f86e632a6b84d074a11549f0342ed`.
Same Apple M2 Max / Darwin 25.5.0 / Chromium 151.0.7922.34 / Bun 1.4.0 environment.

## Reduced-motion floor

`flap-board-static.local.json`, same source and two-departure workload, seven runs:
task median **105.93 ms**, IQR **102.01–109.56 ms**, range **100.22–110.63 ms**.
The board retained 390 elements, zero animations, and zero audio sources. The
window still includes the benchmark's rAF observer and full settlement wait.

## Simplification and regression coverage

- Derive sound cadence from the final bottom's retained effect. This removes
  keyframe inspection and allows audio to join a transition already in progress.
- Skip descendant-reel searches when the mutation target is already a reel.
- Give asynchronous audio starts request ownership so obsolete success/failure
  cannot overwrite a newer toggle. Keep mute/destroy cleanup guards.
- Cover lower-half pixels before cleanup, visible-card bounds, blur off/zero,
  reduced motion, sound density/voice caps, natural settlement, late opt-in,
  interrupted startup, unavailable audio, hiding the page, and active teardown.
- Use inherited visibility in each participating window so a hidden ancestor
  remains hidden; explicit `visible` could override it. Clear blur from active
  flap keyframes when the option turns off, preserving transforms and timeline.
- Replace per-step array prepending with one final reversal; preserve exact paint
  order. No separate speed claim for this small simplification.

## Post-review verification

After the inherited-visibility and immediate blur-disable fixes,
`flap-board-reviewed.local.json` re-ran all three variants under benchmark v4:

| Variant | Task median | Task IQR | Task range | Median rAF p95 |
| --- | ---: | ---: | ---: | ---: |
| Corrected landing, all cards filled | 6142.79 ms | 6053.62–6192.78 | 5962.64–6320.66 | 117.00 ms |
| Reviewed polished board, sound off | 4857.32 ms | 4846.92–4871.74 | 4808.24–5041.75 | 17.33 ms |
| Reviewed polished board, sound on | 5326.61 ms | 5310.60–5415.42 | 5270.13–5466.29 | 17.34 ms |

The reviewed silent board uses **20.9% less** task time than the corrected landing
baseline; opt-in sound adds **9.7%** over silent. Same workload, environment, and
one warmup plus seven rounds per variant. No speed claim for the correctness fixes.

Reviewed source SHA-256: `2f0eb6b1856eb9a384b92d6460b5c13d9229bcba1150246463f1ed778b72b471`.
Flap SHA-256: `522e15e19ddc71752c9cc0182c7245abee0aa9163e253403e0e302ae67922a7a`.

Final validation: typecheck/build, 31 unit tests, 175 browser tests passed across
Chromium/Firefox/WebKit (2 existing skips), and clean packed consumers for React
18/19 and Solid. The showcase clock test now waits for the delivered reduced-motion
fallback before asserting cleanup: WebKit's native media-query event is outside
Playwright's virtual timer clock. Three targeted repetitions and the full suite pass.

## Second pass: fixed board slots and a bounded renderer

The platform column now reserves two text-wheel slots, with a blank on the tens
drum. This is a product correction: a physical board must not insert/remove a
digit when moving between one- and two-digit platforms. The teaser likewise uses
nine permanent slots, alphabet/blank drums, city names only, and a five-second cycle.

The platform change alters the workload's semantic strings, so a fresh retained
baseline was captured as `flap-board-fixed-drums.local.json` rather than pooling
the earlier platform measurements. Source SHA-256:
`d055c4be73626a46622fc396973cc9372cc4190791f3a8cf06b405a2a21fabc1`.

### Profiling redirected the search

A diagnostic Chromium timeline sample spent roughly 1453 ms in Layerize and
890 ms in UpdateLayoutTree, versus about 191 ms in FunctionCall. These events can
nest and are not an additive benchmark result. The sample redirected the work
from speculative parsed-keyframe reuse toward rendering-tree/layer costs.

Experiments, in order:

| Experiment | Matched task medians | Decision |
| --- | --- | --- |
| Remove covered cards from rendering with discrete display | 4948.79 → 4762.46 ms | Modest 3.8% gain; superseded by fixed planes |
| Add per-slot layout/paint containment | 4700.70 → 4687.67 ms | Discard: 0.3% is within noise |
| Four planes, individual glyph elements, local perspective | 4925.42 → 4378.80 ms | Promising, but doubled DOM; replace representation |
| Four compact text strips, shared stepped index, aligned timelines | See below | Keep; simplified further in final review |

The discrete-display trial needed actual parsed-keyframe detection: Firefox
advertised `transition-behavior: allow-discrete` but discarded WAAPI display
keyframes. That whole compatibility branch disappeared with fixed planes.
One-warmup/one-run smoke captures for strip clipping, local projection, and the
first shared-index variants were diagnostic only, not performance evidence.
The early shared-index smoke was also superseded after step-boundary correctness
tests found mismatched rounding; its faster number is not a valid result to claim.

### Fixed text strips reduce elements and native effects

Measured prototype: four clipped text strips, two hinge effects, one shared
registered-number step effect. It retains nine elements/three effects per moving
slot instead of elements/effects proportional to travel. Glyph text and keyframes
remain bounded by one revolution. Line-break glyphs use row elements; the no-
registration fallback uses six native effects. Reduced motion remains static.

`flap-board-shared-strips.local.json`, benchmark v4, one warmup plus seven measured
rounds per variant, rotating forward/reverse pairs. Same Apple M2 Max, Darwin
25.5.0 arm64, Bun 1.4.0, Chromium 151.0.7922.34, 1440 × 1000/DPR 1 environment.
Same two departures, 350 ms interruption, and 6000 ms natural settlement.

| Variant | Task median | Task IQR | Task range | Median rAF p95 |
| --- | ---: | ---: | ---: | ---: |
| Fixed-platform per-card baseline | 4736.81 ms | 4729.04–4892.66 | 4652.42–4984.50 | 17.00 ms |
| Shared strips, sound off | 4007.37 ms | 3963.68–4096.48 | 3880.87–4222.23 | 9.20 ms |
| Shared strips, sound on | 4102.95 ms | 4087.15–4162.73 | 4074.68–4247.12 | 9.30 ms |

Silent task work fell **15.4%**; opt-in sound added **2.4%** over silent in this run.
Active board elements: **6426 → 1891** (70.6% fewer). Active effects: **5370 → 472**
(91.2% fewer). Sound-on samples varied slightly in interrupted progress, as usual.
No faces, shadows, blur, or cadence were removed to achieve the renderer comparison.

Source SHA-256: `fd36121edad24e13c52529d3732bbb753b254a2e713f656fde1979786f02fe58`.
Flap SHA-256: `62024031ebc09d5f15aef8c184e65d2fcf42965df96bd85a88f2fc60883f9c0b`.

### Final simplification and repeat measurement

The final review established that explicit step-end holds work with an
**unregistered discrete custom property**. Removed global registration and the
alternate six-transform path; all three browsers also pass with the registration
API unavailable. Default opaque `Canvas` surfaces now prevent waiting glyphs
bleeding through, with a `--rn-flap-background` override. Board surfaces already
had opaque gradients, so this correction does not change their appearance.

`flap-board-final-strips.local.json` repeats the same v4 workload/environment with
one warmup and seven measured rounds per variant:

| Variant | Task median | Task IQR | Task range | Median rAF p95 |
| --- | ---: | ---: | ---: | ---: |
| Fixed-platform per-card baseline | 4785.81 ms | 4745.38–4836.09 | 4703.47–4873.99 | 17.16 ms |
| Final strips, sound off | 3988.07 ms | 3955.01–4065.57 | 3925.86–4151.18 | 9.30 ms |
| Final strips, sound on | 4070.61 ms | 4039.60–4096.79 | 3997.57–4195.18 | 9.20 ms |

The task reduction repeated at **16.7%**. Opt-in sound adds **2.1%** over silent in
this run. Active elements: **6453 → 1891**; active effects: **5387 → 472**. These
results support the representation change, not a separate speed claim for removing
registration or adding default surfaces.

Final source SHA-256: `ac0c885925de482acc02856b287df97753841ad6082da34a38d1bc4bffaa733a`.
Flap SHA-256: `b3e2ea4ace65fb692f63d4862bd76bc4959bbc4925487163e8c6949d75f64609`.

Final validation: typecheck/build; **36 unit tests**; **196 browser tests passed**
(2 existing skips); packed React 18/19 and Solid consumers passed. Coverage includes
all step boundaries, interrupted resumption, permanent platform/teaser slots,
default light/dark occlusion pixels, line-break glyph rows, no playback layout
reads, blur removal, audio startup races, reduced motion, and active teardown.
