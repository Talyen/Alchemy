// Shared Prettier path globs for format / format:check / pre-commit.
// Keep this list as the single source of truth — do not duplicate in package.json or lefthook.

/** @type {readonly string[]} */
export const PRETTIER_GLOBS = Object.freeze([
  "*.{js,json,md,ts,yml,yaml}",
  ".prettierrc",
  "{src,tests,scripts,desktop,docs,performance}/**/*.{ts,tsx,css,mjs,cjs,md}",
]);

/** Extensions / basenames Prettier should format when given explicit file paths (hooks). */
const PRETTIER_PATH_RE = /(?:^|\/)(?:\.prettierrc)$|(?:\.(?:ts|tsx|css|mjs|cjs|js|json|md|yml|yaml))$/i;

/**
 * @param {readonly string[]} paths
 * @returns {string[]}
 */
export function filterPrettierPaths(paths) {
  return paths.filter((p) => PRETTIER_PATH_RE.test(p.replaceAll("\\", "/")));
}
