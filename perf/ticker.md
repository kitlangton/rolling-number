# Steady-ticker experiment — September 4, 2026

Goal: reduce main-thread task time for a single hero updating about 30 times/sec.
Use `bun run dev --port 4173 --strictPort`, then
`bun run scripts/bench-ticker.ts`. Output defaults to `perf/ticker.local.json`.

Workload: one five-digit counter, 90 updates at 33 ms intervals, 500 ms motion,
650 ms settlement, 144px monospace, ten-digit warmup. One discarded warmup and
seven measured rounds. Vite development server, no framework wrapper or motion
blur. Apple M2 Max, macOS arm64, Bun 1.4.0, headless Chromium 151.0.7922.34.

## Rejected: reuse geometry for previously measured equal-width glyphs

Baseline: commit `01619e1`, source SHA-256
`cf5ee10a1f439f802250b09ee4cbee6a7e61192f7a9c7e52d16518ceb96714a0`.

The experiment cached ten numeral advances, invalidated them on font/size refresh,
and reused the previous geometry when token order and measured widths matched.
It kept hidden measurement text current so ResizeObserver could still detect
typographic changes. Source SHA-256:
`a430fcd90ac287d7d554a98f81b7784f6466d1201b3847953723d74b9f39ead6`.

| | Baseline | Geometry reuse |
| --- | ---: | ---: |
| Median main-thread task time | 166.20 ms | 182.62 ms |
| Explicit layout reads | 630 | 0 |
| Task-time range | 145.34–190.54 ms | 169.58–350.20 ms |

Task samples (ms):
- Baseline: 186.409, 161.741, 145.345, 168.725, 166.199, 190.543, 151.457.
- Reuse: 171.004, 171.032, 350.205, 182.616, 169.581, 218.943, 261.187.

Decision: **discard**. Removing explicit geometry reads did not improve the primary
metric and increased variance. Browsers still perform layout and paint; fewer JS
reads alone do not establish smoother frames. This is not a Canvas/WebGL comparison
or a production FPS claim. An initial post-edit attempt was invalidated by Vite HMR
navigation and discarded before any measured samples; the unchanged run above was
rerun explicitly, without adding retry logic to the benchmark.
