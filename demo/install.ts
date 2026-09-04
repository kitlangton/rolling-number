export const packageName = "@kitlangton/rolling-number";
export const siteUrl = "https://rolling.kitlangton.dev";
export const repository = "https://github.com/kitlangton/rolling-number";

export const installCommands = {
  bun: `bun add ${packageName}`,
  npm: `npm install ${packageName}`,
  pnpm: `pnpm add ${packageName}`,
} as const;
