import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tempRoot = join(tmpdir(), "opencode");
await mkdir(tempRoot, { recursive: true });
const directory = await mkdtemp(join(tempRoot, "rolling-number-consumer-"));
function run(command: string[], cwd = directory): string {
  const result = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`${command.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout.toString().trim();
}
try {
  const artifact = join(directory, "package.tgz");
  run(["bun", "pm", "pack", "--ignore-scripts", "--filename", artifact], root);
  const contents = run(["tar", "-tzf", artifact]).split("\n");
  if (contents.some((path) => /(?:^|\/)(?:src|tests|demo|node_modules)\//u.test(path))) throw new Error("Unexpected source/dev files in tarball");
  console.log(`Packed artifact: ${contents.length} entries\n${contents.join("\n")}`);
  await writeFile(join(directory, "package.json"), JSON.stringify({ name: "rolling-number-consumer", type: "module", private: true }));
  run(["bun", "add", artifact, "react@19.2.8", "react-dom@19.2.8", "@types/react", "@types/react-dom", "typescript"]);
  await writeFile(join(directory, "consumer.tsx"), `
import { createRollingNumber, formatValue } from '@kitlangton/rolling-number';
import { RollingNumber } from '@kitlangton/rolling-number/react';
import { renderToString } from 'react-dom/server';
const exact = formatValue(900719925474099312345n, { locales: 'en-US', format: { useGrouping: false } });
if (exact !== '900719925474099312345') throw new Error('Packed formatter failed');
if (!renderToString(<RollingNumber value={42} locales="en-US" />).includes('42')) throw new Error('Packed SSR failed');
const acceptsDOM = (element: HTMLElement) => createRollingNumber(element, { value: 1 });
console.log('Clean consumer imports, bigint formatting and SSR passed');
`);
  console.log(run(["bun", "run", "consumer.tsx"]));
  run(["bunx", "tsc", "--noEmit", "--strict", "--jsx", "react-jsx", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "consumer.tsx"]);
  const adapter = await readFile(join(directory, "node_modules/@kitlangton/rolling-number/dist/react.js"), "utf8");
  if (!adapter.startsWith('"use client";')) throw new Error("Packed React entry lost its client boundary");
  console.log("Clean NodeNext declarations and React client boundary passed");
} finally {
  await rm(directory, { recursive: true, force: true });
}
