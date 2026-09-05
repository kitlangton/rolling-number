# Pull-request board: vertical blur cost

The current demo is a simulated PR queue, not a live GitHub integration. Its
dataset and field widths differ from the departure board, so the earlier FPS/task
numbers in `flap-board.md` are not a current-board comparison.

## Default: blur small updates, keep full sweeps crisp

Clock flips take 220 ms and use a vertical-only blur kernel; minute/second tens
drums contain only 0–5 so 59 → 00 is one forward flip per seconds slot. Individual
review-state updates also use blur. Full-queue shifts are sharp by default because
full-grid blur materially worsened frame pacing. The Full-board blur checkbox
preserves that heavier treatment as an opt-in.

The vertical effect crossfades sharp text with a clipped, vertically blurred copy
inside each turning half. The source is clipped before filtering. It adds four
elements and four opacity effects per active drum, plus one cached SVG filter
definition per renderer. No layout is read during playback.

## Reproduction

```sh
BENCH_SOUND=1 BENCH_COMPARE_BLUR=1 BENCH_OUTPUT=perf/pr-board-final.local.json bun run scripts/bench-board.ts
```

Benchmark: `pull-request-board-interruption-v2`, dataset `pull-requests-v2`.
Two feed shifts, 350 ms interruption, 6000 ms natural settlement; fixed Date/seed
but native timers and WAAPI. Automatic feed changes are paused. The frozen clock
does not measure live clock ticks. One warmup plus seven measured runs per variant,
rotating forward/reverse pairs in isolated production assets.

Environment: Apple M2 Max, Darwin 25.5.0 arm64, Bun 1.4.0, headless Chromium
151.0.7922.34, 1440 × 1000, DPR 1.

| Same-build treatment | Task median | Task IQR | Task range | Median rAF p95 |
| --- | ---: | ---: | ---: | ---: |
| Default sweep, sound off | 4034.94 ms | 4007.27–4042.62 | 3989.62–4087.82 | 17.39 ms |
| Default sweep, sound on | 4134.71 ms | 4117.35–4167.66 | 4079.91–4209.38 | 17.60 ms |
| Full-board blur, sound off | 4429.95 ms | 4420.47–4489.77 | 4353.74–4548.92 | 33.50 ms |

Full-board blur added 9.8% task work, but its worse frame intervals are the more
important cost. Active elements rose from 2189 to 2849; effects from 588 to 1176.
The preceding `pull-requests-v1` experiment also showed approximately 17 → 33 ms
rAF p95 when enabling vertical blur everywhere. Neither capture measures presented
FPS; both include the settling tail. Do not describe these as locked 60/120 FPS.

Source SHA-256: `a3031767c9dcb2e84e0cfbf68984f1b1c1558435dec13aeb9e8f4448ceee3dfe`.
Flap SHA-256: `0f85b346833434d7c55ba13cc25fb91b6ec90e90d2a7499bf9aa99dcd05a2e24`.

## Next investigation

DOM tuning has diminishing returns for this dense board. Compare a batched
Canvas2D or WebGL2 glyph-atlas renderer against this workload, keeping semantic
HTML, reduced motion, interruption, and fallback. Cache sharp and vertical-smear
glyphs rather than running live SVG filters per half-card. Measure active frames
separately from the idle settlement tail before claiming a frame-rate improvement.
