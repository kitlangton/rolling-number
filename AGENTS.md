# Rolling Number

- This repository owns an original, small rolling-number animation library, its React and Solid adapters, browser demo, and reproducible benchmarks.
- Read `CONTEXT.md` and `docs/research.md` before changing rendering or number semantics.
- Use Bun. Run Vitest through `bun run test`, not `bun test`.
- Keep formatting and transition math pure and tested separately from DOM measurement and animation.
- Never read layout in an animation-frame loop. Batch measurement, bound retained elements, and test interruption and cleanup.
- Preserve a readable static value for SSR, assistive technology, reduced motion, and unsupported environments.
- Performance claims must name a benchmark, workload, comparison version, and environment. Do not claim universal superiority.
- Do not copy another library's source or publish packages without an explicit release request.
