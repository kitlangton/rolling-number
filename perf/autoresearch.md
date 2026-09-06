# Post-0.4.0 efficiency research — September 5, 2026

## Decision

**Keep compact opacity playback.** It reduced main-thread task time by **14.2%**
and **16.6%** in two repeated comparisons of the blur-enabled five-digit ticker.
The blur-off control was essentially flat. The original 100-counter, blur-off
carry/reversal benchmark showed no clear total-work gain. These are separate
workloads; do not pool them or treat the ticker result as a universal speedup.

## Goal and gates

Reduce main-thread work during frequent number updates. Preserve motion timing,
spring trajectories, blur, painted settlement, interruption, and bounded resources.
Work starts at `v0.4.0`, commit `2a920ffcc85141e37be143e85ba5bf461059728e`.

## Benchmark

```sh
BENCH_OUTPUT=perf/autoresearch-baseline.local.json bun run bench
```

Primary metric: CDP `Performance.TaskDuration` through scheduled updates and natural
settlement. `dom-carry-reversal-v1`: production DOM core, 100 counters, 6 Hz over
1,200 ms, 500 ms requested animations, 600 ms settlement, en-US/two fraction digits,
carry/reversal across 999.99 ↔ 1,000.00. Masks on, blur off. One warmup and seven
measured runs per renderer; rotating/reversed order with NumberFlow 0.6.2 and a
plain-text floor. Timing runs are serial. rAF cadence is not presented FPS.

Environment: Apple M2 Max, 96 GiB RAM, macOS 26.5.1 arm64, Bun 1.4.0,
Playwright 1.62.1, headless Chromium 151.0.7922.34, 1440 × 1000/DPR 1,
Arial 24px/tabular digits, no requested CPU throttling.

Baseline source SHA-256:
`a2c9c30dd66f1411fe84228079f2208f53abc98a2b8aa0b6d97232ce8b3c7384`.

| Capture | Task median | Task IQR | Task range | Style median |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 1332.21 ms | 1326.92–1380.91 | 1318.61–1449.14 | 299.97 ms |
| Face CSS | 1329.90 ms | 1326.33–1342.07 | 1318.01–1355.06 | 296.92 ms |
| Compact opacity | 1336.35 ms | 1307.96–1347.21 | 1289.94–1413.37 | 268.56 ms |

All three retained 3,500 settled elements. The compact-opacity source SHA-256 is
`2b6f8766d31ad40c41d2a82de3e79c4ecf799bbafac2a4eba263b74a4a12d6b8`.
Lower style work alone did not establish a total-work improvement in this workload.

## Hypotheses

1. Move the four constant face layout declarations from per-face inline writes
   into a shared CSS rule. Keep row translations, height, and compositing unchanged.
   **Discard:** 0.17% lower task median is measurement noise. The added selectors
   are not justified. Candidate SHA-256:
   `eab953aafdded6bae70aba121b641898dfb9ff39f169c7bb49f5bbeda15eadbe`.
2. Compact opacity playback into two native keyframes. A separate instrumented
   production-build diagnostic attributed about 187 ms of JS self samples to
   native `animate`, versus about 29 ms to spring sampling. Opacity still submits
   every sample as a separate keyframe. Use formatted (already clamped) samples as
   a `linear()` easing between opacity 0 and 1, preserving non-linear clamping and
   equal-endpoint blur pulses. Retain explicit keyframes without `linear()` support.
   **Keep for the repeated blur-enabled ticker gain below.** The implementation
   changes only `Track.play`'s native opacity representation. It retains the same
   logical motion for sampled interruption, same document timeline, same duration,
   same surfaces/kernel, and same cleanup. No cache or dependency is added.

## Separate blur-enabled ticker comparison

```sh
bun run dev --port 4173 --strictPort
# In another terminal, with this checkout served at port 4173:
BENCH_BLUR=compare BENCH_FONT_SIZE=56 \
  BENCH_OUTPUT=perf/autoresearch-ticker.local.json bun run scripts/bench-ticker.ts
```

Existing `scripts/bench-ticker.ts` workload: one five-digit DOM counter, 90 updates
at 33 ms intervals, 500 ms motion, ten-digit warmup, one post-update frame and
650 ms settlement. Font: 56px/1.2 monospace. **Vite development fixture**, without a
React/Solid wrapper. Same hardware/browser as above; viewport 1280 × 800/DPR 1.
Each invocation discards one warmup per mode and measures seven rounds, alternating
blur on/off order. No other agent-run tests, builds, or timing workloads overlapped.

Run order was baseline → candidate → correctness checks → restored baseline →
candidate. Both restored baselines had identical `src/*` fingerprints, as did both
candidates. The ticker fingerprints cover `src/*` and differ from the production
runner's broader fingerprint:

- Baseline: `6e67248f72875da71454d21084c27c390967781cdb7fb933ab045e9b093be8c5`
- Candidate: `24bf2193dba0929cdfa446a7e6e2dbbed3aed040cb70ef8f364571d82691f8ee`

| Capture | Blur-on median | Blur-on range | Blur-off median | Blur-off range |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 213.165 ms | 199.112–217.145 | 139.198 ms | 135.684–142.284 |
| Candidate | 182.992 ms | 176.781–194.623 | 139.612 ms | 133.633–155.339 |
| Restored baseline | 232.948 ms | 227.680–238.834 | 150.232 ms | 148.618–156.510 |
| Candidate repeated | 194.335 ms | 190.451–202.200 | 152.432 ms | 146.901–153.547 |

Blur-on task medians fell by 30.173 and 38.613 ms across roughly 3.63 seconds of
updates/settlement, with non-overlapping baseline/candidate ranges in both pairs.
Blur-off medians rose by 0.414 and 2.200 ms, within overlapping ranges. The baseline
drift between invocations is why a single before/after sample would be insufficient.

All runs still made 630 explicit geometry reads. Blur-on runs retained a median
87 active and 31 settled elements; blur-off retained 47–48 active and 28 settled
elements. Active snapshots depend on animation progress and are not peak memory
measurements. No GPU time, battery use, presented FPS, production hero, or Safari
performance improvement is claimed.

## Verification

- The new browser check compares actual computed opacity with an independent
  explicit-native-keyframe reference at 97 times per trajectory, including native
  completion. It covers rising/falling fades, high/low overshoot, delayed entrances,
  blur pulses, and interrupted blur starts, in both normal and inverted form.
- Run each with and without `linear()` support in Chromium, Firefox, and WebKit.
  Maximum allowed opacity difference is 0.00001; cancellation leaves no effects.
- Existing painted-blur and native-completion alignment checks remain correctness
  gates, alongside continuous pointer input, interruption, fallback, and cleanup.
- Installed Safari 26.5 on macOS 26.5.1 passed all 31 existing painted-blur and
  alignment checks (maximum horizontal drift about 0.0012 CSS px). A separate
  WebDriver invocation of the same fixture's 14 compact-opacity/reference cases
  reported zero computed-opacity difference and no retained effects.
- Full validation passed: `bun run check` (typecheck, 47 unit/SSR tests, package
  build), `bun run test:browser --grep-invert 'sound|audio' --workers=1` (325 passed,
  2 skipped), `bun run test:package` (19-entry tarball; clean React 18/19, Solid, and
  NodeNext consumers), `bun run build:demo`, and `git diff --check`.

## Raw primary samples

Milliseconds, in measured round order; warmups excluded. Local full captures use
the `perf/autoresearch-*.local.json` names but are intentionally not committed.

Production carry/reversal:

| Capture | Seven task-time samples |
| --- | --- |
| Baseline | 1318.609, 1376.433, 1327.694, 1332.207, 1385.386, 1449.143, 1326.145 |
| Face CSS | 1339.768, 1325.536, 1344.379, 1329.900, 1318.009, 1355.055, 1327.121 |
| Compact opacity | 1289.942, 1342.952, 1319.382, 1413.366, 1351.474, 1336.352, 1296.536 |

Ticker:

| Capture | Blur | Seven task-time samples |
| --- | --- | --- |
| Baseline | on | 199.112, 213.126, 210.716, 213.660, 213.892, 213.165, 217.145 |
| Baseline | off | 140.887, 136.576, 139.198, 139.074, 142.284, 135.684, 140.544 |
| Candidate | on | 176.781, 182.992, 179.241, 181.496, 188.296, 191.621, 194.623 |
| Candidate | off | 133.633, 142.755, 139.612, 136.614, 143.717, 138.975, 155.339 |
| Restored baseline | on | 230.103, 234.503, 229.871, 238.834, 232.948, 234.838, 227.680 |
| Restored baseline | off | 155.264, 154.726, 156.510, 150.232, 150.162, 150.103, 148.618 |
| Candidate repeated | on | 192.926, 195.313, 194.335, 190.451, 192.895, 194.407, 202.200 |
| Candidate repeated | off | 149.289, 153.298, 149.708, 146.901, 153.224, 153.547, 152.432 |

## Stopping point

This bounded pass tested two hypotheses and kept one. The blur-off stress workload
still spends substantial time in native style/layout/paint and animation setup.
Further tiny JS changes need new evidence; the unchanged primary stress result
does not justify accumulating speculative micro-optimizations. This is a useful
incremental gain, not evidence that the renderer is at its efficiency ceiling.

## Prior dead ends

Geometry caching, state-attribute guards, and unchanged-target horizontal-track
reuse already failed to show durable wins. See [ticker.md](ticker.md),
[state-attributes.md](state-attributes.md), and [retarget.md](retarget.md).
