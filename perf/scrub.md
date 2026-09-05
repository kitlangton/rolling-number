# Scrub responsiveness — September 4, 2026

## Stronger smear after the startup fix

Scrub now sets `--rn-blur: 2.4` instead of 1.4. This increases only the existing
vertical kernel; no new layers, animation effects, or duration changes. Digits
sharpen on settlement, punctuation and units remain crisp, and keyboard input
stays immediate. The scoped browser proof passes in all three engines.

`scrub-stronger-blur.local.json` reruns `production-scrub-native-pointer-v2` with
one warmup and seven alternating rounds per build on Apple M2 Max, Darwin 25.5.0,
Bun 1.4.0, Chromium 151.0.7922.34, 1280 × 900/DPR 1. Both variants include the
startup fix. Task medians: 578.45 ms at 1.4 (IQR 566.33–584.47; range 545.80–609.95)
and 566.03 ms at 2.4 (IQR 560.94–587.38; range 536.85–592.24). Ranges overlap;
this is a visual change, not a claimed speedup. Both had 9.10 ms median rAF p95
and zero startup stalls in every run. rAF cadence is not presented FPS.
Candidate source SHA-256: `7559d394810e37d1801151350a964692e3359a8001e3ac00b60d0d25a0fa632e`.

## Follow-up: native animation startup starvation

The earlier replay measured frame cadence and the final value, but not whether
the reels advanced between inputs. That missed a real bug: an animation created
with `Element.animate()` can remain play-pending at time zero until a later paint.
Native pointer input can replace it before that happens, repeatedly sampling the
same position and velocity. Good rAF intervals do not prove that digits move.

A visible-browser drag through Browser Control reproduced 276 zero-time
replacements out of 508 reel effects. Explicitly assigning each running effect's
`startTime` to its owner document's current timeline eliminated those replacements
in the same gesture: 0 of 509. `animateNow` synchronizes roll, blur, layout, and
flap effects. It preserves deliberately paused animations and does not introduce
a JS animation loop, performance-clock interpolation, shorter duration, or blur
removal. The 160 ms Scrub duration is unchanged.

The new regression drives actual Playwright pointer input; synthetic input inside
rAF did **not** reproduce the bug. Chromium failed with 106 stalled replacements
before the fix. Chromium, Firefox, and WebKit pass afterward. Only replacements
after the document timeline advances count as eligible, so several events in a
single frame are not misclassified as stalls.

### Repeated native-pointer benchmark

```sh
BENCH_POINTER=1 BENCH_BASELINE=perf/scrub-repro-baseline.local.json BENCH_OUTPUT=perf/scrub-native-pointer.local.json bun run scripts/bench-scrub.ts
```

`production-scrub-native-pointer-v2`: 160 real pointer moves, forward then reverse,
with motion blur enabled; 650 ms settlement. One warmup plus seven alternating
measured runs per isolated production build. Retained builds are rerun with the
same new driver; old synthetic-input measurements are not pooled into the result.
Apple M2 Max, Darwin 25.5.0, Bun 1.4.0, headless Chromium 151.0.7922.34,
1280 × 900/DPR 1. Cadence samples cover the gesture, not the settlement tail.

| Metric | Pending-start baseline | Frame-anchored effects |
| --- | ---: | ---: |
| Zero-time replacements, median | 438 / 523 | 0 / 523 |
| Zero-time replacements, range | 0–439 | 0–0 |
| Task work, median | 551.40 ms | 538.52 ms |
| Task work, IQR | 548.78–558.55 | 524.74–552.80 |
| Task work, range | 529.03–562.10 | 509.27–588.45 |
| rAF p95, median | 9.10 ms | 9.10 ms |

The win is eliminating startup starvation, not a demonstrated FPS improvement.
Task ranges overlap. The baseline's occasional zero-stall run also explains why
this bug could escape earlier checks: pointer/frame alignment matters.

Baseline source SHA-256: `a85639a25308c79925e2338fed1b38c085c803abc944c1a03002421132c753e5`.
Fixed source SHA-256: `dd6d623e1168c0d463cd0e47aed4160c8036a7f4bca6084001760825d9c98124`.

## Earlier work: state isolation and shorter tail

**Keep:** give the continuously updated Scrub example its own React state and cap
its animation at 160 ms instead of 350 ms. No library timing defaults, blur
features, or interruption math changed.

## Reproduction and hypotheses

A native pointer drag over the real demo produced 70 input changes and also
reformatted each unrelated example 70 times. A smaller regression drag produced
90 needless calls across just the revenue, likes, and invoice counters. After
moving state into `Scrub`, those calls dropped to zero. The same test measured
350 ms of native animation remaining after release; the new cap brings this
below 180 ms in that gesture. Keyboard changes remain immediate.

Ranked hypotheses:

1. Gallery-wide state propagation does unnecessary work: isolate the state without
   changing motion, then measure. Confirmed.
2. Rebuilding blurred strips is expensive: disable or redesign only if needed.
   Not pursued; keep the requested visual quality.
3. The 350 ms tail feels delayed during direct manipulation: shorten only Scrub's
   duration. Kept as a responsiveness choice, not a CPU optimization.

## Actual production input replay

`scripts/bench-scrub.ts` builds isolated production assets and dispatches 120 range
inputs at native rAF cadence, through the real React handler, between pointerdown
and pointerup. Values sweep sinusoidally between roughly 12000 and 108000 with
reversals, then finish at 95724. The window includes 650 ms natural settlement.
It asserts readable and painted `95,724 km`, active motion during dragging, and
no remaining Scrub animations. Geometry checks occur after task measurement.

This is an in-page input replay, not an OS pointer-latency benchmark. Separate
browser tests use real Playwright mouse drags. The real page's other timers remain
enabled. One warmup plus seven measured rounds per variant; retained baseline and
candidate builds alternate in one Chromium invocation.

```sh
BENCH_KEEP_BUILD=1 BENCH_OUTPUT=perf/scrub-before.local.json bun run scripts/bench-scrub.ts
BENCH_BASELINE=perf/scrub-before.local.json BENCH_OUTPUT=perf/scrub-final.local.json bun run scripts/bench-scrub.ts
```

Environment: Apple M2 Max, Darwin 25.5.0 arm64, headless Chromium 151.0.7922.34,
Bun 1.4.0, 1280 × 900, DPR 1, en-US. No NumberFlow comparison.

| Matched experiment | Variant | Task median | Task IQR | Task range |
| --- | --- | ---: | ---: | ---: |
| State isolation only | Baseline, 350 ms | 389.72 ms | 387.47–390.66 | 382.32–396.08 |
| State isolation only | Isolated, 350 ms | 357.65 ms | 355.02–371.69 | 350.64–409.54 |
| Faster direct response | Baseline, 350 ms | 393.75 ms | 389.13–397.50 | 377.80–442.70 |
| Faster direct response | Isolated, 160 ms | 378.69 ms | 377.80–383.43 | 368.53–396.31 |

Isolation removed 8.2% median task work in the first comparison. The final faster
animation used 3.8% less than its matched baseline, a smaller benefit with overlapping
ranges. Per-round rAF p95 medians stayed around 9.0–9.1 ms: this machine did not
reproduce frame stalls. Do not claim improved displayed FPS. The stronger evidence
is eliminated unrelated work and the shorter native response tail.

Source SHA-256 (source, demo, Vite config, manifest, lockfile):

- Baseline: `d7c9d488c0dc8eb6dd2020945638e52b3e8e75e9c1d03e3414f231bda05931b0`
- Isolated: `08224feb65c8a03fb5446b47be32ba08c61582d5fbaeb1eeec9a7eedf65498ab`
- Isolated + 160 ms: `5fe47d4af59652ad7b7d527e4ecdc4e865c71eb7c00618476025c48e8ca3a410`

Captures: `scrub-before.local.json`, `scrub-isolated.local.json`, `scrub-final.local.json`.
The scoped simplify pass keeps the local-state boundary and existing pointer/
keyboard handling; it introduces no new scheduler, memoization cache, or renderer API.
