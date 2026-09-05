# Current DOM comparison — September 4, 2026

In this workload, the current Rolling Number DOM core used **59.8% less
main-thread task time** and **56.7% fewer settled elements** than NumberFlow 0.6.2.
This is not a universal speed claim, a React-adapter benchmark, or a presented-FPS
measurement. Both libraries had long frame intervals under this synchronized load.

## Reproduce

```sh
BENCH_OUTPUT=perf/results.local.json bun run bench
```

Benchmark: `dom-carry-reversal-v1`, 100 counters, 6 Hz scheduled carry/reversal
updates over 1200 ms, 500 ms requested animations, plus 600 ms natural settlement.
Numbers cross 999.99 ↔ 1,000.00 with en-US formatting and two fraction digits.
Blur is off. There is one discarded warmup plus seven measured runs per renderer,
with rotating/reversed order. Delayed updates are recorded, not dropped.

Environment: Apple M2 Max, Darwin 25.5.0 arm64, Bun 1.4.0, headless Chromium
151.0.7922.34, 1440 × 1000/DPR 1, Arial 24px/tabular digits, no requested CPU
throttling. Plain text is a non-animated lower-bound reference.

| Renderer | Task median | Task IQR | Task range | Settled elements |
| --- | ---: | ---: | ---: | ---: |
| Plain text | 25.30 ms | 24.38–28.49 | 22.71–31.86 | 200 |
| NumberFlow 0.6.2 | 3387.30 ms | 3346.79–3413.19 | 3293.79–3433.91 | 6700 |
| Rolling Number working tree | 1360.68 ms | 1342.59–1362.61 | 1310.87–1388.05 | 2900 |

Task time is the CDP `Performance.TaskDuration` delta through updates and
settlement; it is not wall time. Element counts include shared hosts and open
shadow roots. Median per-run rAF p95 was 311.96 ms for NumberFlow and 125.83 ms
for Rolling Number, versus 9.10 ms for plain text. These intervals expose stalls;
they must not be converted into claims of a locked frame rate.

The requested initial spin/layout easing is matched. Interruption velocity,
traversed faces, opacity timing, and layout paths are not identical. The benchmark
checks final formatting, settlement, and actual active playback; see
[the full methodology](method.md) and [raw runs](results-2026-09-04.json).

The package manifest still says 0.4.0, but this capture includes unreleased changes.
Identify the implementation by its source SHA-256, not by the published package:
`b7a0776640a7d33b3974868b138aaade4c33fcd062da6dfbf3588156299ac293`.

The [React comparison lab](react-comparisons.md) additionally includes React
Animated Numbers and React CountUp. Its in-browser measurements are a separate
workload and are not pooled with these DOM results.
