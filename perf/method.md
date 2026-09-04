# Performance methodology

## Target

Reduce browser main-thread work for frequent numeric updates without sacrificing
interruption continuity, correct formatting, responsive geometry or accessibility.

Primary planned metric: Chromium `TaskDuration` during an equal, bounded animated
workload. Secondary metrics: layout/style time, frame intervals, DOM element count,
mount cost and minified + gzip bundle size. Submission time alone is insufficient:
an implementation can defer all its work and appear artificially cheap.

## Rules

- Pin the comparison package and browser versions in the lockfile/results.
- Use identical fonts, container sizes, values, instance counts, update cadence,
  animation durations and motion preferences for both implementations.
- Compare DOM core to DOM core. React adapter overhead is a separate question.
- Warm each implementation once, then alternate order across at least seven runs.
- Report medians and spread, not a selected best run.
- Include animation-enabled and motion-disabled results and a native-text floor.
- Count shadow DOM elements for implementations that use shadow roots.
- Keep correctness tests separate from timing assertions; CI is too noisy for tiny
  timing gates. Include no-op updates, rapid reversal and growth/shrink workloads.
- Record browser, OS, hardware and limits. These are local microbenchmarks, not a
  claim that a library wins for every application or browser.

## Hypotheses to test

1. A bounded glyph representation can reduce element count and mount work relative
   to a full ten-digit stack for every place.
2. Batched geometry reads and compositor transforms can reduce repeated layout work.
3. Caching formatters and avoiding work when the formatted display is unchanged can
   reduce frequent-update cost.
4. Native animation playback may avoid a JavaScript animation-frame loop while
   preserving continuity on interruption.

## Initial baseline

On the local Apple M2 Max, Chromium 151.0.7922.34, 100 counters at 6 Hz, seven
measured runs: Rolling Number's median task time was 1934.54 ms versus 3358.88 ms
for NumberFlow 0.6.2. Settled element counts were 2900 versus 6700. These include
the shared benchmark host elements and NumberFlow shadow roots.

The first representation used 49 full transform keyframes for each active
property. Next hypothesis: preserving the same sampled trajectory as a CSS
`linear()` easing between two transform keyframes reduces animation setup cost,
without changing interruption sampling. Retain the 49-keyframe fallback for
browsers without `linear()` support and the zero-distance/nonzero-velocity case.

## Outcome

Kept the compact **transform-only** representation after measurements and browser
regressions. The final median was 1540.43 ms, versus 1822.67 ms for the corrected
49-keyframe baseline. Compact opacity was rejected because clamping makes its
mapping non-linear. See [results and limitations](results.md) for the final matched
NumberFlow comparison, static workload, environment, spread and data files.
