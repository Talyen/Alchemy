import path from "node:path";
import os from "node:os";
import { open } from "node:fs/promises";

export function assetLibraryRoot() {
  return path.resolve(process.env.ASSET_LIBRARY_ROOT || path.join(os.homedir(), "Documents", "Asset Library"));
}

export function resolveAssetSource(source) {
  const root = assetLibraryRoot();
  const resolved = path.resolve(root, source);
  if (!source || path.isAbsolute(source) || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Asset source must be library-relative: ${source}`);
  }
  return resolved;
}

/** Read each selected source before any pipeline can publish or prune outputs. */
export async function requireAssetSources(entries) {
  for (const { source } of entries) {
    const filename = resolveAssetSource(source);
    try {
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
        `Cannot read Asset Library source "${source}". Download it in Finder if iCloud has offloaded it, or set ASSET_LIBRARY_ROOT. Existing outputs were preserved.`,
        { cause },
      );
    }
  }
}
