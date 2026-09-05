# Rolling Number

## Start here

This repository owns the `@kitlangton/rolling-number` library, its React and Solid
adapters, a number showcase, and reproducible benchmarks. Read [CONTRIBUTING.md](CONTRIBUTING.md)
for setup and checks. Read [CONTEXT.md](CONTEXT.md) and [docs/research.md](docs/research.md)
before changing rendering or number semantics.

## Repository map

- `src/format.ts`: Intl formatting, glyphs, and stable place identities.
- `src/motion.ts`, `src/layout.ts`: pure transition and layout math.
- `src/index.ts`, `src/scheduler.ts`: DOM ownership and batched measurement.
- `src/track.ts`, `src/blur.ts`, `src/flap.ts`: native effects and cleanup.
- `src/react.tsx`, `src/solid.ts`: thin framework adapters; preserve SSR.
- `src/styles.css`: required, explicitly imported stylesheet.
- `demo/main.tsx`: public number showcase. `demo/board*` and `demo/gpu-flap*`
  are a separate experiment, excluded from the default site build.
- `demo/benchmarks.tsx`: unlisted React comparison page; `demo/bench.ts` is the
  separate CLI-controlled DOM benchmark. Do not pool their measurements.
- `tests/`: Vitest unit/SSR tests; `tests/browser/`: Playwright behavior tests.
- `scripts/verify-package.ts`: packed-artifact checks in clean consumers.
- `perf/`: qualified measurements and experiment history, not universal claims.

## Commands

Use Bun (CI currently pins 1.4.0). Run Vitest through `bun run test`, **not** `bun test`.

```sh
bun install --frozen-lockfile
bun run check
bunx playwright install chromium firefox webkit
bun run test:browser --workers=1
bun run test:package
bun run build:demo
```

Run focused tests while iterating. Before handing off library changes, run the
full checks above. Browser binaries must be installed locally; Linux may need
`bunx playwright install --with-deps chromium firefox webkit`.

## Invariants

- Keep formatting and transition math pure and tested apart from DOM measurement.
- Never read layout in a playback animation-frame loop. Batch reads before writes.
- New targets interrupt; they do not enqueue behind older targets. Preserve the
  sampled position/velocity and bound retained elements, effects, and listeners.
- Keep every effect on the owning document's timeline. Test continuous **pointer**
  input too: synthetic rAF updates alone missed native animation-start starvation.
- Preserve readable SSR, one accessible value, reduced motion, and static fallbacks
  for unsupported APIs, formats, and environments. Do not suppress hydration warnings.
- Match existing style: TypeScript, two-space indentation, semicolons, named exports.
  Avoid unrelated formatting sweeps and new runtime dependencies without a clear need.
- Keep adapters reactive, with stable identities and cleanup; do not perform
  per-frame React/Solid state updates or introduce server-side DOM access.

## Proof and scope

- Test interruption, settlement, cleanup, and fallback—not only the final text.
  For visual defects, inspect painted output as well as computed transforms.
- Performance claims must name the benchmark, workload, comparison version,
  source revision/fingerprint, browser, and hardware. Use repeated runs and report
  spread. rAF callback cadence is **not** presented FPS.
- Do not change visuals or silently cancel playback to improve a benchmark.
  Keep timing workloads isolated from other CPU/GPU work.
- Do not copy another library's source. Do not commit credentials, private data,
  recordings from third parties, generated builds, or scratch benchmark captures
  (`*.local.json`). Reviewed reports may include their reproducible raw data.
- Preserve unrelated working-tree changes. Do not push, publish npm packages, or
  deploy the website without an explicit request for that operation.
- The repository does not use Changesets. Do not introduce a release workflow as
  part of a routine fix. `bun run deploy` deploys the **website**, not the package.
