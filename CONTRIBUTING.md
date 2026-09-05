# Contributing

Rolling Number is a small, MIT-licensed TypeScript library. Contributions should
keep number formatting predictable, motion interruptible, and the static value
readable. You do not need an API key or a Cloudflare account to work on it.

## Run the project locally

Install [Bun](https://bun.sh/) (CI uses 1.4.0), then:

```sh
git clone https://github.com/kitlangton/rolling-number.git
cd rolling-number
bun install --frozen-lockfile
bun run dev
```

Open the URL Vite prints. The main page is the number showcase; `/test.html` and
`/solid.html` are browser-test fixtures. Read [CONTEXT.md](CONTEXT.md) for domain
terms and [AGENTS.md](AGENTS.md) for the source map and rendering constraints.

## Choose the smallest check that proves the change

```sh
# Types, pure/SSR tests, and package build
bun run check

# Focused examples while iterating
bun run test tests/motion.test.ts
bun run test:browser tests/browser/scrub.spec.ts --project=chromium --workers=1

# Full browser coverage
bunx playwright install chromium firefox webkit
bun run test:browser --workers=1

# Real tarball in clean React 18/19 and Solid consumers; never publishes
bun run test:package

# Public site, including generated Markdown docs
bun run build:demo
```

On Linux, Playwright may need system dependencies:
`bunx playwright install --with-deps chromium firefox webkit`.
Browser tests start their own Vite server on port 4173. Outside CI they reuse an
existing server at that port; ensure it serves this checkout. Avoid editing files
during a browser run: a dev-server reload can replace the page under a test.

Run all checks before submitting changes to rendering, formatting, adapters, or
packaging. Test a real pointer drag when changing continuous input. Include reduced
motion, interruption, cleanup, and SSR/fallback cases relevant to your change.

## Report bugs and propose changes

Use [GitHub issues](https://github.com/kitlangton/rolling-number/issues). A useful
report includes a minimal reproduction, package/framework versions, browser/OS,
locale and formatting options, expected behavior, and actual behavior. For motion
bugs, a short recording is helpful; do not include private data or credentials.

For a new public option or a large redesign, open an issue with a consumer example
before implementing it. Explain which existing use case it cannot express. Keep
PRs focused and include the exact verification commands you ran. If a check was
not run, say so rather than marking it passed. Keep discussions respectful and
focused on the code; disagree with ideas, not people.

Use the surrounding TypeScript style and avoid unrelated formatting. A behavior
fix should usually include a regression test at the public API or browser seam.
Contributions are covered by the repository's [MIT license](LICENSE); do not submit
source copied from another animation library.

## Benchmarks need both speed and correctness

`bun run bench` compares the DOM implementation with the pinned NumberFlow version
and a plain-text baseline. See [perf/method.md](perf/method.md). Run timing work on
an otherwise idle machine; do not run it alongside browser tests or rendering jobs.
Report medians and spread, the full workload, source fingerprint, browser, and
hardware. Do not equate rAF callbacks with presented FPS or compare different
visual treatments as if they did the same work.

Local captures (`perf/*.local.json`), `dist/`, `site/`, test output, and dependencies
are ignored. Curated benchmark reports can be committed with enough information to
reproduce them; keep machine-specific scratch paths out of user-facing instructions.

## Website assets and experimental work

The Open Graph PNG is checked in at `demo/public/og-rolling-number.png`. To regenerate
it from the actual renderer, install Playwright Chromium and run `bun run build:og`.
Review the resulting image before committing it. System fonts can differ by OS;
the current card was generated on macOS. Normal builds copy the PNG without needing
a browser or remote fonts.

`/benchmarks.html` is an unlisted, noindex React comparison page. Its comparison
packages are development dependencies and do not enter the npm library. Changing
a library version or workload requires updating the displayed methodology and
rerunning measurements. Its in-browser elapsed/rAF metrics are not the CLI's CDP
main-thread task measurements. Export JSON to preserve a run with its environment
and source fingerprint.

The standalone PR flap board is available locally at `/board.html`; it is not part
of the default public site build or the npm package. Its GPU renderer is unfinished.
See [docs/experiments.md](docs/experiments.md) before working on it.

## Releases and deployments are maintainer operations

`bun run deploy` builds and deploys the website to the configured Cloudflare domain.
It requires the maintainer's Cloudflare access and is **not** a contributor setup
step. It does not publish npm packages.

There is no Changesets or automatic npm-publishing workflow. Keep unreleased API
changes clearly identified in docs; do not bump versions or publish as part of an
ordinary PR. A package release requires explicit maintainer approval, full
validation, and packed-artifact verification.
