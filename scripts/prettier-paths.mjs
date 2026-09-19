// Shared Prettier path globs for format / format:check / pre-commit.
// Keep this list as the single source of truth — do not duplicate in package.json or lefthook.

const EXTENSIONS = ["ts", "tsx", "mts", "css", "mjs", "cjs", "js", "json", "md", "yml", "yaml"];

/** @type {readonly string[]} */
export const PRETTIER_GLOBS = Object.freeze([`**/*.{${EXTENSIONS.join(",")}}`, ".prettierrc"]);

/** Extensions / basenames Prettier should format when given explicit file paths (hooks). */
const PRETTIER_PATH_RE = new RegExp(`(?:^|/)(?:\\.prettierrc)$|\\.(?:${EXTENSIONS.join("|")})$`, "i");

// Paths Prettier must skip even when staged explicitly.
// Intentional subset of .prettierignore (not a full mirror): the CLI only sees
// staged source paths, while .prettierignore also covers build outputs
// (dist/, reports/, Raw Assets/, ...). Keep the four entries below in sync with
// .prettierignore or filterPrettierPaths will format what `prettier --check`
// ignores (or vice versa). See prettier-paths.test.ts parity assertion.
export const PRETTIER_NEVER_FORMAT_RE =
  /(?:^|\/)(?:package-lock\.json|CHANGELOG\.md)$|\.generated\.ts$|(?:^|\/)src\/lib\/game-data\/gear-art\.ts$/;

/**
 * @param {readonly string[]} paths
 * @returns {string[]}
 */
export function filterPrettierPaths(paths) {
  return paths.filter((p) => {
    const normalized = p.replaceAll("\\", "/");
    if (PRETTIER_NEVER_FORMAT_RE.test(normalized)) return false;
    return PRETTIER_PATH_RE.test(normalized);
  });
}
