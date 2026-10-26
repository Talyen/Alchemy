import path from "node:path";
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

/** Read every selected repo-local master before publishing or pruning outputs. */
export async function requireAssetSources(entries) {
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
