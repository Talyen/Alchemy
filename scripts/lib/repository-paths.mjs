import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

// Verification must see new files even when Git's filesystem caches are stale.
// Command-local overrides leave the user's persistent Git configuration intact.
const UNCACHED_GIT_OPTIONS = ["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false"];

/**
 * Single git-spawn owner for script tooling: every call runs above the
 * checkout with stale-cache overrides unless opted out, so file inventories
 * cannot disagree between helpers. Returns the raw spawn result; callers keep
 * their own status handling. (git-safety-guard.mjs cannot use this — it must
 * exec the real git binary past its own shim, with the caller's cwd/options.)
 */
export function runGit(rootDir, args, { uncached = true, stdio } = {}) {
  return spawnSync("git", [...(uncached ? UNCACHED_GIT_OPTIONS : []), ...args], {
    cwd: rootDir,
    encoding: "utf8",
    // Keep stderr piped: listRepositoryFiles + resolvePushPaths surface it in
    // their throw messages, and callers rely on result.stderr being a string.
    stdio: stdio ?? ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
}

/**
 * Single repo-relative path owner. Resolves `file` against `rootDir` with
 * forward slashes; the root itself maps to `"."`. Outside paths throw unless
 * `onOutside` is `"keep-relative"` (pass through for membership tests) or
 * `"basename"` (diagnostics that must always render something short).
 */
export function toRepoRelative(rootDir, file, { onOutside = "throw" } = {}) {
  const relative = path
    .relative(rootDir, path.resolve(rootDir, String(file).replaceAll("\\", "/")))
    .replaceAll(path.sep, "/");
  const outside = relative === ".." || relative.startsWith("../") || path.isAbsolute(relative);
  if (!outside) return relative || ".";
  if (onOutside === "keep-relative") return relative;
  if (onOutside === "basename") return path.basename(String(file));
  throw new Error(`Path is outside repository: ${file}`);
}

function normalizeRepositoryPath(rootDir, file) {
  return toRepoRelative(rootDir, file);
}

/** List tracked + untracked repository files via Git's inventory. Throws on Git failure. */
export function listRepositoryFiles(rootDir) {
  const result = runGit(rootDir, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  if (result.status !== 0)
    throw new Error(`Could not list repository files: ${result.error?.message ?? result.stderr}`);
  return [...new Set(result.stdout.split("\0").filter(Boolean))].sort();
}

/** Expand directories from Git's inventory, retaining deleted files for risk selection. */
export function expandRepositoryPaths(rootDir, paths) {
  let inventory;
  const selected = new Set();
  for (const file of paths) {
    const relative = normalizeRepositoryPath(rootDir, file);
    if (!statSync(path.resolve(rootDir, relative), { throwIfNoEntry: false })?.isDirectory()) {
      selected.add(relative);
      continue;
    }
    if (!inventory) {
      try {
        inventory = listRepositoryFiles(rootDir);
      } catch (error) {
        throw new Error(
          `Could not expand directory selection ${file}: ${error instanceof Error ? error.message : String(error)}`,
          {
            cause: error,
          },
        );
      }
    }
    const files = inventory.filter((entry) => relative === "." || entry.startsWith(`${relative}/`));
    if (!files.length) throw new Error(`Directory contains no repository files: ${file}`);
    for (const entry of files) selected.add(entry);
  }
  return [...selected];
}
