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
function verifyConsumer(version: number): void {
  console.log(`React ${version}: ${run(["bun", "run", "consumer.tsx"])}`);
  console.log(`React ${version} production: ${run(["env", "NODE_ENV=production", "node", "consumer.mjs"])}`);
  run(["bunx", "tsc", "--noEmit", "--strict", "--jsx", "react-jsx", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "consumer.tsx"]);
}
try {
  const artifact = process.argv[2] ? resolve(process.argv[2]) : join(directory, "package.tgz");
  if (!process.argv[2]) run(["bun", "pm", "pack", "--ignore-scripts", "--filename", artifact], root);
  const contents = run(["tar", "-tzf", artifact]).split("\n");
  if (contents.some((path) => /(?:^|\/)(?:src|tests|demo|node_modules)\//u.test(path))) throw new Error("Unexpected source/dev files in tarball");
  console.log(`Packed artifact: ${contents.length} entries\n${contents.join("\n")}`);
  await writeFile(join(directory, "package.json"), JSON.stringify({ name: "rolling-number-consumer", type: "module", private: true }));
  run(["bun", "add", artifact, "react@19.2.8", "react-dom@19.2.8", "@types/react", "@types/react-dom", "typescript"]);
  await writeFile(join(directory, "consumer.tsx"), `
import { createRollingNumber, createRollingText, formatValue, FLAP_CHARSET, type Stagger } from '@kitlangton/rolling-number';
import { RollingNumber, RollingText } from '@kitlangton/rolling-number/react';
import { renderToString } from 'react-dom/server';
const exact = formatValue(900719925474099312345n, { locales: 'en-US', format: { useGrouping: false } });
if (exact !== '900719925474099312345') throw new Error('Packed formatter failed');
if (!renderToString(<RollingNumber value={42} locales="en-US" stagger="start" />).includes('42')) throw new Error('Packed SSR failed');
if (!renderToString(<RollingText text="EDINBURGH" charset={FLAP_CHARSET} />).includes('EDINBURGH')) throw new Error('Packed text SSR failed');
if (!renderToString(<RollingText text="Hello" transition="direct" />).includes('Hello')) throw new Error('Packed direct-text SSR failed');
const order: Stagger = 'end';
const acceptsDOM = (element: HTMLElement) => [createRollingNumber(element, { value: 1, stagger: order }), createRollingText(element, { text: 'A' })];
console.log('Clean consumer imports, bigint formatting and SSR passed');
`);
  await writeFile(join(directory, "consumer.mjs"), `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { RollingNumber, RollingText } from '@kitlangton/rolling-number/react';
for (const [component, props, expected] of [
  [RollingNumber, { value: 42, locales: 'en-US' }, '42'],
  [RollingText, { text: 'Hello', transition: 'direct' }, 'Hello'],
]) {
  if (!renderToString(createElement(component, props)).includes(expected)) throw new Error('Packed production React render failed');
}
console.log('Clean production React rendering passed');
`);
  verifyConsumer(19);
  const stylesheet = run(["bun", "-e", "console.log(import.meta.resolve('@kitlangton/rolling-number/styles.css'))"]);
  const css = await readFile(new URL(stylesheet), "utf8");
  if (!css.includes(".rn-root") || !css.includes("mask-image")) throw new Error("Packed stylesheet is missing renderer styles");
  const adapter = await readFile(join(directory, "node_modules/@kitlangton/rolling-number/dist/react.js"), "utf8");
  if (!adapter.startsWith('"use client";')) throw new Error("Packed React entry lost its client boundary");
  if (/jsx-dev-runtime|jsxDEV/.test(adapter)) throw new Error("Packed React entry uses the development JSX runtime");
  console.log("Clean NodeNext declarations, stylesheet export and React client boundary passed");
  run(["bun", "add", "solid-js@1.9.15"]);
  await writeFile(join(directory, "solid-consumer.ts"), `
import { createComponent } from 'solid-js';
import { renderToString } from 'solid-js/web';
import { RollingNumber, RollingText } from '@kitlangton/rolling-number/solid';
const html = renderToString(() => createComponent(RollingNumber, { value: 9007199254740993n, locales: 'en-US', class: 'balance' }));
if (!html.includes('9,007,199,254,740,993') || !html.includes('rn-solid balance')) throw new Error('Packed Solid SSR failed');
if (!renderToString(() => createComponent(RollingText, { text: 'PARIS', stagger: 'start' })).includes('PARIS')) throw new Error('Packed Solid text SSR failed');
if (!renderToString(() => createComponent(RollingText, { text: 'Hello', transition: 'direct' })).includes('Hello')) throw new Error('Packed Solid direct-text SSR failed');
if (html.includes('data-rn-hydrated') || html.includes('rn-reel')) throw new Error('Solid SSR mounted the DOM core');
console.log('Clean Solid consumer imports and SSR passed');
`);
  console.log(run(["bun", "run", "solid-consumer.ts"]));
  run(["bunx", "tsc", "--noEmit", "--strict", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "solid-consumer.ts"]);
  run(["bun", "build", "solid-consumer.ts", "--target", "browser", "--outfile", "solid-consumer.js"]);
  run(["bun", "add", "react@18.3.1", "react-dom@18.3.1", "@types/react@18", "@types/react-dom@18"]);
  verifyConsumer(18);
} finally {
  await rm(directory, { recursive: true, force: true });
}
