import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const fingerprint = createHash("sha256");
for (const path of [...readdirSync(new URL("./src/", import.meta.url)).map((name) => `src/${name}`), ...readdirSync(new URL("./demo/", import.meta.url)).filter((name) => /\.(tsx?|css|html)$/.test(name)).map((name) => `demo/${name}`), "package.json", "bun.lock"].sort()) {
  fingerprint.update(`${path}\0`); fingerprint.update(readFileSync(new URL(path, import.meta.url)));
}

export default defineConfig({
  root: "demo",
  base: "./",
  define: { "import.meta.env.BENCH_SOURCE": JSON.stringify(fingerprint.digest("hex")) },
  optimizeDeps: {
    // Prebundle the browser fixture's SSR entry too, avoiding a dependency
    // discovery reload in the middle of the first hydration test.
    include: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client", "react-dom/server", "number-flow", "solid-js", "solid-js/web"],
  },
  build: {
    outDir: "../site",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        main: new URL("./demo/index.html", import.meta.url).pathname,
        benchmarks: new URL("./demo/benchmarks.html", import.meta.url).pathname,
        // Standalone experiment, excluded from the Rolling Number site build.
        ...(process.env.FLAP_BOARD ? { board: new URL("./demo/board.html", import.meta.url).pathname } : {}),
        // The benchmark page is built only for `bun run bench`, not for the public site.
        ...(process.env.ROLLING_NUMBER_BENCH ? { bench: new URL("./demo/bench.html", import.meta.url).pathname } : {}),
      },
    },
  },
});
