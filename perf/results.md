# Local comparison — September 4, 2026

**100 counters, 6 updates/second, 1.2-second carry/reversal sequence, 500 ms requested
animations.** Production builds; one warmup and seven measured rounds per renderer,
alternating/rotating order. Apple M2 Max, macOS arm64, headless Chromium
151.0.7922.34, Playwright 1.62.1. NumberFlow is pinned to 0.6.2.
This capture uses the default linear reel-edge masks and the dark benchmark page.
The measured source is commit `35155ca`, before format-to-format transitions and
the Solid adapter were added. These are retained baseline measurements, not a new
measurement of those additions. Use the commands below to measure the current tree.

## Animation enabled

| Metric | Plain text | NumberFlow | Rolling Number |
| --- | ---: | ---: | ---: |
| Median main-thread task time | 20.44 ms | 3196.91 ms | **1302.93 ms** |
| Task-time interquartile range | 19.95–21.85 ms | 3134.44–3268.41 ms | 1244.69–1319.41 ms |
| Median layout time | 2.91 ms | 426.50 ms | 60.49 ms |
| Median style-recalculation time | 0.48 ms | 2082.84 ms | 329.11 ms |
| Settled elements, including shadow DOM | 200 | 6700 | **2900** |
| Median mount task time | 1.81 ms | 27.95 ms | 25.56 ms |
| Median of each run's rAF-interval p95 | 9.10 ms | 300.99 ms | 99.46 ms |

Rolling Number used **59.2% less main-thread task time** and **56.7% fewer retained
elements** than NumberFlow in this specific workload. It still exceeded a 16.7 ms
main-thread frame budget under this stress. rAF callback intervals are **not**
presented compositor frames, FPS or dropped-frame counts.

The earlier unmasked capture recorded 1540.43 ms task time and 46.32 ms rAF p95.
This run has lower task time but worse rAF timing. It is not an isolated mask
A/B experiment, so neither change is attributed solely to masking. The fade is
a visual choice, not a performance optimization; `--rn-mask: none` opts out.

## Animation disabled

| Metric | Plain text | NumberFlow | Rolling Number |
| --- | ---: | ---: | ---: |
| Median main-thread task time | 18.58 ms | 278.10 ms | **29.91 ms** |
| Task-time interquartile range | 18.26–22.08 ms | 275.86–283.84 ms | 28.82–31.09 ms |
| Settled elements, including shadow DOM | 200 | 6700 | 500 |

This is a separate static-update workload, not an animation performance claim.

## Package size at the measured revision

The minified core entry plus shared chunk total **4569 bytes gzip** (about 4.46 KiB,
compressed separately). The explicit stylesheet adds **622 bytes gzip**. The React
adapter adds **589 bytes gzip**, excluding the React peer dependency. Sizes are
from `bun run build`; installed declarations/docs are not browser runtime payload.

## What was kept and rejected

- Initial 49-transform-keyframe implementation: 1934.54 ms median task time.
- After lifecycle correctness fixes, repeated baseline: 1822.67 ms.
- Compact transform representation before edge masks: 1540.43 ms, **15.5% less than the corrected
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
