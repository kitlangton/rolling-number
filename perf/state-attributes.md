# State-attribute experiment — September 4, 2026

## Decision: discard

Guarding repeated writes of `data-rn-measuring` and `data-rn-ready` initially
appeared to reduce main-thread work. A later control did not sustain that result.
The two guards were removed; no animation timing, trajectory, blur, or geometry
change is retained from this research round.

The earlier [horizontal retarget experiment](retarget.md) was also discarded.

## Workload and comparison

- `bun run bench`: `dom-carry-reversal-v1`, 100 counters, 6 Hz, 1.2 seconds,
  requested 500 ms motion, default masks, blur off; production DOM core.
- Primary metric: Chromium CDP `TaskDuration` through natural settlement, not FPS.
- One warmup and seven measured rounds per renderer per invocation. Each invocation
  rotates/alternates Rolling Number, NumberFlow 0.6.2, and the native-text floor.
- Baseline: the working tree originally based on `8b381ac`, including its existing
  uncommitted stagger changes, without either experiment. Source-tree SHA-256:
  `992d4d61f6c09fa38409f7120f073a2938fcdfcb839926be356a7bf77c50fba9`.
- Attribute-guard candidate SHA-256:
  `6bf1523412d6fb0742dd876fb1e71530d82d28fa0c8384ab28959c690eab2fbb`.
- Apple M2 Max, macOS 26.5.1 arm64, Bun 1.4.0, Playwright 1.62.1,
  headless Chromium 151.0.7922.34. No CPU throttling requested.

## Completed captures

| Capture | Median task ms | Range ms | Median style ms | Median of rAF p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Initial baseline | 1493.79 | 1395.69–1600.44 | 322.40 | 159.13 |
| Guards | 1375.10 | 1358.21–1443.97 | 295.36 | 116.32 |
| Restored baseline | 1458.20 | 1389.03–1506.63 | 315.25 | 132.01 |
| Guards repeated | 1359.20 | 1233.68–1428.64 | 286.86 | 107.77 |

All retained 2900 settled elements including shared hosts. The early median
differences were 7.9% and 6.8%, but these are **not a durable speed claim**.
The unchanged NumberFlow control also varied: medians were 3428.04, 3276.87,
3221.65, and 3116.90 ms respectively. Another session was working in the repository
during the early captures; those runs cannot establish isolated causality.

Local full captures, in table order:

- `retarget-before.local.json`
- `state-attributes-after.local.json`
- `state-attributes-before-repeat.local.json`
- `state-attributes-after-repeat.local.json`

A separate candidate motion-disabled run completed at 31.10 ms median task time
(`state-attributes-static.local.json`). It is not an animation improvement or a
paired static comparison. rAF callback intervals are not presented compositor
frames; these results say nothing definitive about perceptual smoothness.

## Failed final control and benchmark isolation

A final restored-baseline control printed task samples of 1370.37, 1316.16,
1334.70, 1331.02, 1340.13, 1537.77, and 1347.67 ms before failing to serialize:

```text
ENOENT: no such file or directory, open '.../rolling-number/site/bench.html'
```

The incomplete capture is **not** included in a published aggregate. Its printed
samples nevertheless contradict the early apparent advantage, so the guards were
discarded rather than selecting only favorable runs.

`site/` contained the ordinary demo output by the end, without the benchmark page.
Both the demo and benchmark previously used that directory with `emptyOutDir`.
The exact process that replaced the files was not identified. One earlier
interrupted invocation also produced no completed capture and was discarded.

The retained infrastructure change in `scripts/bench.ts` builds and previews from
a unique temporary directory per invocation, then removes that exact directory
in `finally`. Concurrent demo builds can no longer replace its assets or remove
the HTML fingerprint before serialization. This isolates artifacts, **not CPU
load**; timing runs still require otherwise idle conditions.

`BENCH_TMPDIR` optionally selects the temporary-directory parent. The default is
the operating system's temp directory. No site deployment or npm release is
part of this change.

## Verification

- `bun run check`: typecheck, 16 unit tests, and package build passed on the final
  tree with both rendering experiments removed.
- `bun run test:browser --workers=2`: 115 passed, two existing skips, across
  Chromium, Firefox, and WebKit. Coverage includes reversal, growth/shrink,
  interruption position, blur cleanup, reduced motion, and native-text fallbacks.
- Isolation smoke: `BENCH_COUNT=2 BENCH_ROUNDS=1 bun run bench`, launching
  `bun run build:demo` immediately after the first `warmup plain:` output. The
  benchmark completed and serialized all three measured renderer samples while
  `site/bench.html` remained absent. Its unique temp directory was removed.
  Capture: `bench-isolation.local.json`. This deliberately concurrent, single-round
  smoke is a correctness check, **not performance evidence**.

The committed reversal in `813d0a5` removed `Track.target` but left its callers in
`src/index.ts`. The working tree's removal of those callers is retained so the
discard is complete; it restores the original runtime rather than introducing
another optimization.
