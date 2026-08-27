/** Shared Vite alias and SSR optimizer include list for vite + vitest. */
export const VITE_ALIAS_PATH = "@";
export const VITE_ALIAS_TARGET = "./src";

/** Modules that Vitest SSR optimizer must pre-bundle (see vitest.config.ts deps.optimizer.ssr.include). */
export const SSR_OPTIMIZE_INCLUDE = [
  "@/lib/game-data",
  "@/lib/battle",
  "@/lib/validation",
  "@/lib/gear",
  "@/lib/routing",
  "@/features/alchemy/shared",
];
