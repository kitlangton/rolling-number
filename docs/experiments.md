# Standalone flap-board experiment

The PR board is a **prototype**, not an npm export or a feature of the public
Rolling Number site. Its queue is fictional and never reads or changes GitHub data.

Run `bun run dev` and open `/board.html`. Use the Renderer selector to compare the
existing DOM implementation with the WebGL2 prototype. `?renderer=dom` starts on
the DOM implementation. No special hardware or audio permission is needed for the
readable HTML fallback; sound is an explicit opt-in.

## What is implemented

- `demo/board.tsx` owns the queue, clock, controls, and semantic HTML.
- `demo/board-sound.ts` synthesizes capped, grouped impacts locally.
- `demo/gpu-flap-motion.ts` contains pure forward-drum transition math.
- `demo/gpu-flap-atlas.ts` rasterizes sharp and vertical-smear glyphs once.
- `demo/gpu-flap-shaders.ts` and `demo/gpu-flap.ts` implement instanced half-card
  rendering and resource ownership behind a decorative canvas.

## What is not proved yet

Initial Chromium output has been inspected. The GPU path still needs cross-browser
pixel, interruption, context-loss, resize, and cleanup coverage, followed by a
matched benchmark against DOM with equivalent visuals. Do not claim it is faster
or move it into the library based only on fewer DOM elements.

`scripts/bench-board.ts` currently benchmarks the **DOM** board, not the GPU path.
Historical departure-board and current PR-board results use different datasets;
see [perf/pull-request-board.md](../perf/pull-request-board.md).

For a local production build that includes the prototype:

```sh
FLAP_BOARD=1 bun run build:demo
```

Do not use that flag for a normal website deployment. Experimental files remain
outside `src/` and outside the package's `files` allowlist.
