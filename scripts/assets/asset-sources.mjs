import path from "node:path";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { open, realpath } from "node:fs/promises";
import { REPO_ROOT } from "../lib/repository-paths.mjs";

export function assetSourceRoot() {
  return path.join(REPO_ROOT, "assets/sources");
}

export function resolveAssetSource(source) {
  const root = assetSourceRoot();
  const resolved = path.resolve(root, source);
  if (!source || path.isAbsolute(source) || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Asset source must be relative to assets/sources: ${source}`);
  }
  return resolved;
}

// Restore only missing, explicitly sparse index entries. Publish a completed
// checkout atomically without replacing a file created by another process.
function restoreSparseSources(entries) {
  const safeParent = (file) => {
    let directory = REPO_ROOT;
    for (const part of path.relative(REPO_ROOT, path.dirname(file)).split(path.sep)) {
      directory = path.join(directory, part);
      if (fs.lstatSync(directory, { throwIfNoEntry: false })?.isSymbolicLink()) return false;
    }
    return true;
  };
  const missing = entries.flatMap(({ source }) => {
    const file = resolveAssetSource(source);
    return !/trailer/iu.test(source) && safeParent(file) && !fs.lstatSync(file, { throwIfNoEntry: false })
      ? [path.relative(REPO_ROOT, file).replaceAll(path.sep, "/")]
      : [];
  });
  if (!missing.length) return;
  const gitOptions = ["--literal-pathspecs", "-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false"];
  const enabled = spawnSync("git", [...gitOptions, "config", "--bool", "core.sparseCheckout"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (enabled.status !== 0 || enabled.stdout.trim() !== "true") return;
  const inventory = spawnSync("git", [...gitOptions, "ls-files", "-t", "-z", "--", ...missing], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (inventory.status !== 0) return;
  const missingSet = new Set(missing);
  const sparse = inventory.stdout
    .split("\0")
    .filter((entry) => entry.startsWith("S ") && missingSet.has(entry.slice(2)))
    .map((entry) => entry.slice(2));
  if (!sparse.length) return;
  const cache = path.join(REPO_ROOT, ".cache");
  let temporary;
  try {
    fs.mkdirSync(cache, { recursive: true });
    const cacheStat = fs.lstatSync(cache);
    if (!cacheStat.isDirectory() || cacheStat.isSymbolicLink()) return;
    temporary = fs.mkdtempSync(path.join(cache, "source-restore-"));
    const checkout = spawnSync(
      "git",
      [
        ...gitOptions,
        "checkout-index",
        "--ignore-skip-worktree-bits",
        `--prefix=${temporary}${path.sep}`,
        "-z",
        "--stdin",
      ],
      { cwd: REPO_ROOT, input: sparse.join("\0") + "\0", encoding: "utf8" },
    );
    if (checkout.status !== 0) return;
    for (const relative of sparse) {
      const staged = path.join(temporary, relative);
      const target = path.join(REPO_ROOT, relative);
      if (!fs.lstatSync(staged, { throwIfNoEntry: false })?.isFile() || !safeParent(target)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (!safeParent(target)) continue;
      try {
        fs.linkSync(staged, target);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
  } catch {
    // Unknown or unsupported storage falls through to the usual preflight error.
  } finally {
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  }
}

/** Read every selected repo-local master before publishing or pruning outputs. */
export async function requireAssetSources(entries) {
  restoreSparseSources(entries);
  const root = path.join(await realpath(REPO_ROOT), "assets/sources");
  for (const { source } of entries) {
    const filename = resolveAssetSource(source);
    try {
      // A symlink must not silently reconnect production preparation to an external library.
      if (!(await realpath(filename)).startsWith(`${root}${path.sep}`)) {
        throw new Error("Source resolves outside the repository assets/sources directory");
      }
      const file = await open(filename, "r");
      try {
        if (!(await file.stat()).isFile()) throw new Error("Not a file");
        const buffer = Buffer.alloc(1);
        if ((await file.read(buffer, 0, 1, 0)).bytesRead === 0) throw new Error("Empty source");
      } finally {
        await file.close();
      }
    } catch (cause) {
      throw new Error(
        `Cannot read repository asset source "${source}". Restore it under assets/sources (git sparse-checkout disable in a code-only task) or update its selection. Existing outputs were preserved.`,
        { cause },
      );
    }
  }
}
