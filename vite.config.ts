import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  base: "./",
  build: {
    outDir: "../site",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        main: new URL("./demo/index.html", import.meta.url).pathname,
        bench: new URL("./demo/bench.html", import.meta.url).pathname,
      },
    },
  },
});
