# Local comparison — September 4, 2026

**100 counters, 6 updates/second, 1.2-second carry/reversal sequence, 500 ms requested
animations.** Production builds; one warmup and seven measured rounds per renderer,
alternating/rotating order. Apple M2 Max, macOS arm64, headless Chromium
151.0.7922.34, Playwright 1.62.1. NumberFlow is pinned to 0.6.2.

## Animation enabled

| Metric | Plain text | NumberFlow | Rolling Number |
| --- | ---: | ---: | ---: |
| Median main-thread task time | 22.26 ms | 3477.89 ms | **1540.43 ms** |
| Task-time interquartile range | 20.43–25.33 ms | 3445.04–3514.81 ms | 1531.20–1551.81 ms |
| Median layout time | 2.85 ms | 471.21 ms | 58.92 ms |
| Median style-recalculation time | 0.48 ms | 2233.89 ms | 422.91 ms |
| Settled elements, including shadow DOM | 200 | 6700 | **2900** |
| Median mount task time | 1.84 ms | 28.38 ms | 21.70 ms |
| Median of each run's rAF-interval p95 | 9.10 ms | 306.72 ms | 46.32 ms |

Rolling Number used **55.7% less main-thread task time** and **56.7% fewer retained
elements** than NumberFlow in this specific workload. It still exceeded a 16.7 ms
main-thread frame budget under this stress. rAF callback intervals are **not**
presented compositor frames, FPS or dropped-frame counts.

## Animation disabled

| Metric | Plain text | NumberFlow | Rolling Number |
| --- | ---: | ---: | ---: |
| Median main-thread task time | 21.01 ms | 275.50 ms | **30.25 ms** |
| Task-time interquartile range | 20.85–22.13 ms | 273.34–277.00 ms | 29.98–32.12 ms |
| Settled elements, including shadow DOM | 200 | 6700 | 500 |

This is a separate static-update workload, not an animation performance claim.

## Package size

The minified core entry plus shared chunk total **4569 bytes gzip** (about 4.46 KiB,
compressed separately). The explicit stylesheet adds **512 bytes gzip**. The React
adapter adds **589 bytes gzip**, excluding the React peer dependency. Sizes are
from `bun run build`; installed declarations/docs are not browser runtime payload.

## What was kept and rejected

- Initial 49-transform-keyframe implementation: 1934.54 ms median task time.
- After lifecycle correctness fixes, repeated baseline: 1822.67 ms.
- Final compact transform representation: 1540.43 ms, **15.5% less than the corrected
  baseline**. Retained after interruption, fallback and lifecycle tests passed.
- **Rejected:** using compact endpoints for clamped opacity. Clamping is non-linear;
  equal endpoint opacities can conceal an intermediate dip. Opacity retains explicit
  samples and has a browser regression test.

## Limits and reproduction

```sh
bun run bench
BENCH_ANIMATED=0 bun run bench
BENCH_COUNT=1000 BENCH_ROUNDS=7 bun run bench
```

The 1000-counter command is available; it is **not** part of the published results.
These runs compare ordinary ungrouped DOM APIs, not framework wrappers or
NumberFlowGroup. Offscreen pausing is disabled for Rolling Number during comparison.
Values, fonts, durations and zero-velocity easing are matched, but interrupted
trajectories, opacity timing and layout paths differ. Neither engine is assigned
zero cost for deferred work: measurement covers update submission, frame flushes
and natural settlement. Plain text is a non-animated lower bound.

No claim is made about universal superiority, presented-frame smoothness, mobile
hardware, or memory consumption from element counts alone. See
[methodology](method.md), [animated data](results-animated.json), and
[static data](results-static.json). Captures include environment, build fingerprint,
source-tree fingerprint, per-round timings and statistical spread.
