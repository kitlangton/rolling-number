# Horizontal playback experiment — September 4, 2026

Goal: avoid redundant horizontal spring setup without changing a moving glyph's
position or velocity when a digit-only update leaves its destination unchanged.

## Baseline

- Command: `bun run bench` (one warmup, seven measured rounds per renderer).
- Primary metric: CDP `TaskDuration`, updates through natural settlement.
- Workload: `dom-carry-reversal-v1`, 100 counters at 6 Hz for 1.2 seconds, 500 ms
  requested motion, production build; default masks, blur off.
- Comparison: current working tree at `8b381ac`, including existing uncommitted
  stagger-timing changes. Source-tree SHA-256:
  `992d4d61f6c09fa38409f7120f073a2938fcdfcb839926be356a7bf77c50fba9`.
- Apple M2 Max, macOS 26.5.1 arm64, headless Chromium 151.0.7922.34.
- Baseline median task time: **1493.79 ms**, range **1395.69–1600.44 ms**.
- Full local capture: `perf/retarget-before.local.json`.

## Hypothesis

`Renderer.commit` replaces every horizontal track on every update, including
settled tracks and in-flight tracks whose destination has not changed. Keeping
those tracks avoids constructing redundant springs and replacing native effects.
The original playback deadline should survive digit-only updates.

A temporary browser probe confirmed that the horizontal animation is replaced
during same-width updates. The candidate added a `Track.target` getter and
skipped horizontal `play` calls unless duration was zero, the origin shifted, or
the destination changed.

## Outcome

**Discard.** Median task time fell to **1428.20 ms** (4.4%), but the candidate's
**1337.06–1562.41 ms** range overlapped the baseline substantially. This is not a
clear speed win. The implementation and temporary behavior-specific probe were
removed, preserving the pre-existing stagger changes.

Candidate source-tree SHA-256:
`8c98f8c67a50ace1d9a7c36606d2fbe6f48a656cc56096c99c5bc388dc106f25`.
Full local capture: `perf/retarget-after.local.json`.

## Next experiment: redundant state attributes

Setting `data-rn-measuring` and `data-rn-ready` to the same value on every commit
may invalidate stylesheet selectors unnecessarily. Guard those two writes; do
not change trajectories, measurement order, or glyph representation.

Pending measurement against the same baseline, with horizontal playback restored.
