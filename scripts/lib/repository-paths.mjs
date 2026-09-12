import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

function normalizeRepositoryPath(rootDir, file) {
  const relative = path.relative(rootDir, path.resolve(rootDir, file.replaceAll("\\", "/"))).replaceAll(path.sep, "/");
  if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative))
    throw new Error(`Path is outside repository: ${file}`);
  return relative || ".";
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
      const result = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        cwd: rootDir,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      if (result.status !== 0)
        throw new Error(`Could not expand directory selection: ${result.error?.message ?? result.stderr}`);
      inventory = [...new Set(result.stdout.split("\0").filter(Boolean))].sort();
    }
    const files = inventory.filter((entry) => relative === "." || entry.startsWith(`${relative}/`));
    if (!files.length) throw new Error(`Directory contains no repository files: ${file}`);
    for (const entry of files) selected.add(entry);
  }
  return [...selected];
}
