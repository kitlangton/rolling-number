import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  base: "./",
  optimizeDeps: {
    // Prebundle the browser fixture's SSR entry too, avoiding a dependency
    // discovery reload in the middle of the first hydration test.
    include: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client", "react-dom/server", "number-flow"],
  },
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
