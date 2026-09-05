# React comparison lab

The unlisted `/benchmarks.html` route is an interactive comparison of four React
integrations. It is deliberately separate from `bun run bench`, which measures the
DOM core against NumberFlow using CDP main-thread task metrics.

| Library | Pinned version | What it animates |
| --- | --- | --- |
| Rolling Number | source fingerprint shown on page | Individual glyphs with replacement springs |
| [NumberFlow React](https://number-flow.barvian.me/) | 0.6.2 | Individual glyphs with composed transitions |
| [React Animated Numbers](https://github.com/heyman333/react-animated-numbers) | 1.1.1 | Digit reels through Motion |
| [React CountUp](https://github.com/glennreyes/react-countup) | 6.5.3 | Interpolated numeric values, not individual glyphs |

The comparison uses public APIs only. The three comparison packages are
MIT-licensed development dependencies; they do not enter the published library.
The Bun lockfile pins transitive dependencies too. Vite's development and production
CommonJS-default interop differs for Animated Numbers and CountUp, so the comparison
normalizes that module boundary before rendering.

## Workload

Run a production build for useful measurements. The page uses React 19.2.8,
Arial, tabular digits, positive integers, en-US grouping, no blur, 500 ms requested
transitions, and a fixed carry/reversal sequence at 6 Hz. Choose 10, 50, or 100
counters; keep the full grid visible. Each library receives a discarded warmup
and seven measured runs. Multi-library runs rotate and reverse order and mount
only one renderer at a time.

Mount settlement is outside the timed window. The timed window includes updates
and a natural settlement tail. Render failures, a hidden/resized page, reduced
motion, or explicit cancellation invalidate the active run. Completed earlier runs
remain visible with their actual sample count.

## Read the metrics correctly

- **Elapsed median/IQR:** wall time including scheduling and settlement, not CPU work.
- **rAF p95 median:** median of each run's 95th-percentile callback interval; not
  presented FPS, GPU time, or a dropped-frame count.
- **Elements:** settled DOM descendants, including open shadow roots and shared
  cell wrappers; not memory consumption.

Export JSON for raw samples, settings, source SHA-256, DPR, viewport, and user agent.
Record hardware and browser version alongside that file before making a claim.
Changing the selected workload clears prior measurements rather than relabeling them.

These are not identical visual treatments. CountUp is a different kind of effect;
even the reel libraries have different travel, retargeting, and easing behavior.
The page checks that counters render, but it does not claim automated final-pixel
equivalence. Inspect the motion and final values before interpreting a result.
For an automated, fixed-workload task-time comparison, use the DOM benchmark and
[its methodology](method.md), not this page's wall-time table.
