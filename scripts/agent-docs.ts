// Emits agent-readable copies of the docs next to the built site: the README as
// Markdown, an llms.txt index, and static-asset headers. Runs after `vite build`.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { installCommands, packageName, repository, siteUrl } from "../demo/install";

const site = new URL("../site/", import.meta.url);
await mkdir(site, { recursive: true });

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
// Relative repository links only resolve on GitHub; make them absolute for agents.
const markdown = readme.replace(/\]\((?!https?:|#|mailto:)\.?\/?([^)]+)\)/g, `](${repository}/blob/main/$1)`);

const llms = `# Rolling Number

> ${packageName}: a small TypeScript library for interruptible rolling numbers with native browser animation playback, Intl.NumberFormat formatting (numbers and BigInt), and React and Solid adapters. MIT.

Install with \`${installCommands.bun}\` or \`${installCommands.npm}\`. Import \`${packageName}/styles.css\` once. The unscoped "rolling-number" npm package is a different project.

## Docs

- [README](${siteUrl}/index.md): install, DOM, React and Solid APIs, formatting, layout, motion blur and accessibility notes
- [Source repository](${repository}): TypeScript source, tests and benchmarks
- [npm package](https://www.npmjs.com/package/${packageName})

## Optional

- [Design context](${repository}/blob/main/CONTEXT.md): vocabulary for digit places, symbol roles and transitions
- [Research notes](${repository}/blob/main/docs/research.md): renderer trade-offs and reference findings
- [Benchmark results](${repository}/blob/main/perf/results.md): qualified NumberFlow comparison; run "bun run bench" locally
`;

const headers = `/llms.txt
  Content-Type: text/plain; charset=utf-8
/*.md
  Content-Type: text/markdown; charset=utf-8
`;

await Promise.all([
  writeFile(new URL("index.md", site), markdown),
  writeFile(new URL("llms.txt", site), llms),
  writeFile(new URL("_headers", site), headers),
]);
console.log("agent docs: index.md, llms.txt, _headers");
