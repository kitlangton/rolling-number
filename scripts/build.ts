import { copyFile, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ["src/index.ts", "src/react.tsx"],
  outdir: "dist",
  format: "esm",
  target: "browser",
  splitting: true,
  minify: true,
  external: ["react", "react/jsx-runtime"],
});
if (!result.success) throw new AggregateError(result.logs, "Build failed");
await mkdir("dist", { recursive: true });
await copyFile("src/styles.css", "dist/styles.css");
// Preserve the React Server Components boundary after bundler directive removal.
await Bun.write("dist/react.js", `"use client";\n${await Bun.file("dist/react.js").text()}`);
for (const output of result.outputs) {
  const bytes = new Uint8Array(await Bun.file(output.path).arrayBuffer());
  console.log(`${output.path.split("/").at(-1)}: ${bytes.length} B / ${Bun.gzipSync(bytes).length} B gzip`);
}
