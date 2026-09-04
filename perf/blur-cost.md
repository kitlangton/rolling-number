# Optional blur cost — September 4, 2026

This compares `motionBlur: false` and `true` on the **same DOM core build**, not
React/Solid overhead or another library. Source-tree SHA-256:
`1ee31d664e5785b86242138ac21f23f488602c3445a39e3a370e017ee3b15744`.

Run the dev server on port 4173, then:

```sh
BENCH_BLUR=compare BENCH_FONT_SIZE=56 bun run scripts/bench-ticker.ts
```

## Workload and environment

- One five-digit counter, 90 updates at 33 ms intervals, requested 500 ms motion.
- 56px/1.2 monospace; one post-update frame plus 650 ms settlement.
- One warmup per mode, seven measured rounds per mode, alternating mode order.
- Apple M2 Max, macOS arm64, Bun 1.4.0, headless Chromium 151.0.7922.34.
- Vite development server. No other agent-run tests or benchmarks ran concurrently.

## Results

| Metric | Blur off | Blur on |
| --- | ---: | ---: |
| Median main-thread task time | 225.15 ms | 295.04 ms |
| Task-time range | 145.53–332.25 ms | 251.84–544.72 ms |
| Explicit layout reads | 630 | 630 |
| Median elements after last update | 36 | 74 |
| Settled elements | 23 | 26 |

The median difference was **69.89 ms**, about **31% more main-thread work** over
roughly **3.63 seconds** of continuous updates. Spread was substantial; this is
not a precise universal multiplier. These are main-thread task times, not GPU
time, presented FPS, battery use or memory measurements.

Extra copies and opacity effects exist only during motion. The three retained
elements after settlement are the shared SVG/filter/blur definition for that
counter; disabling blur or destroying it removes those too. Element counts exclude
the shared host and are snapshots, not peak DOM or byte measurements.

The interactive cards usually update on a click, drag, or timer tick rather than
continuously at 30 Hz. This test does not measure those exact interactions or
their entrance animations. Larger fonts, more simultaneous counters, other
browsers, and lower-powered devices can change the cost considerably. Blur remains
opt-in and is a visual tradeoff, not an optimization.

## Per-round observations

| Round | First mode | Off task ms | On task ms | Off active elements | On active elements |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | On | 164.43 | 337.18 | 36 | 64 |
| 2 | Off | 332.25 | 256.31 | 43 | 78 |
| 3 | On | 238.89 | 295.04 | 39 | 68 |
| 4 | Off | 145.53 | 487.27 | 35 | 74 |
| 5 | On | 186.44 | 255.06 | 35 | 80 |
| 6 | Off | 240.36 | 251.84 | 43 | 76 |
| 7 | On | 225.15 | 544.72 | 35 | 70 |
