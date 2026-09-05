import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

// Regenerate the checked-in social card with `bun run build:og`.
const root = resolve(import.meta.dirname, "..");
const bundle = await Bun.build({ entrypoints: [resolve(root, "scripts/og-scene.ts")], target: "browser", format: "esm" });
if (!bundle.success) throw new AggregateError(bundle.logs, "Open Graph scene build failed");
const css = await readFile(resolve(root, "src/styles.css"), "utf8");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    ${css}
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body { background: #0d0e10; color: #ededeb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
    header { position: absolute; top: 52px; left: 70px; right: 70px; display: flex; align-items: baseline; justify-content: space-between; }
    #title { font-size: 42px; font-weight: 550; letter-spacing: -.055em; line-height: 1.35; --rn-blur: 1.8; }
    .category { font-size: 16px; color: #777b83; letter-spacing: .01em; }
    .hero { position: absolute; inset: 156px 44px 133px; display: flex; align-items: center; justify-content: center; font-size: 230px; font-weight: 450; line-height: 1.28; letter-spacing: -.065em; font-variant-numeric: tabular-nums; }
    #number { --rn-blur: 2.4; --rn-edge-fade: .1em; }
    .unit { color: #999b9f; margin-left: .1em; }
    footer { position: absolute; left: 70px; right: 70px; bottom: 56px; display: flex; justify-content: space-between; align-items: baseline; }
    .tagline { color: #a1a4aa; font-size: 22px; letter-spacing: -.025em; }
    .url { color: #656970; font-size: 16px; }
  </style></head><body>
    <header><span id="title">rolling number</span><span class="category">React · Solid · TypeScript</span></header>
    <div class="hero"><span id="number">9,708</span><span class="unit">ms</span></div>
    <footer><span class="tagline">Numbers with a little momentum.</span><span class="url">rolling.kitlangton.dev</span></footer>
  </body></html>`);
  await page.evaluate((frame) => { document.documentElement.dataset.ogFrame = frame; }, process.env.OG_FRAME ?? "12");
  await page.addScriptTag({ content: await bundle.outputs[0]!.text(), type: "module" });
  await page.waitForSelector("html[data-og-ready]");
  if (errors.length) throw new Error(errors.join("\n"));
  await mkdir(resolve(root, "demo/public"), { recursive: true });
  const output = resolve(root, process.env.OG_OUTPUT ?? "demo/public/og-rolling-number.png");
  await page.screenshot({ path: output });
  console.log(`Open Graph: ${output} (1200 × 630)`);
} finally { await browser.close(); }
