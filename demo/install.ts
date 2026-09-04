export const packageName = "@kitlangton/rolling-number";
export const siteUrl = "https://rolling.kitlangton.dev";
export const repository = "https://github.com/kitlangton/rolling-number";

export const installCommands = {
  bun: `bun add ${packageName}`,
  npm: `npm install ${packageName}`,
  pnpm: `pnpm add ${packageName}`,
} as const;

/** Pasted into a coding agent. Short, with the docs URL so the agent reads fresh details. */
export const agentPrompt = `Add ${packageName} to this project for animated rolling numbers.

1. Install it: ${installCommands.bun} (or npm/pnpm). The unscoped "rolling-number" package is a different project.
2. Read ${siteUrl}/llms.txt first; it links the full README as Markdown.
3. Import "${packageName}/styles.css" once, then use "${packageName}/react" (RollingNumber component), "${packageName}/solid", or the framework-independent "${packageName}" DOM API.
4. Pass numbers or BigInts as \`value\`; use \`locales\` and Intl.NumberFormat \`format\` options for currency, units, percent and precision. Do not pre-format the value into a string.
5. Keep containers around the number free of overflow-x clipping, and reserve width with CSS min-width if layout shift matters. Reduced motion, SSR and assistive text are handled by the library.`;
