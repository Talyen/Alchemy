import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * True when this module was executed directly via `node path/to/file.mjs`.
 * @param {string} importMetaUrl `import.meta.url` of the calling module
 * @returns {boolean}
 */
export function isMainModule(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    // realpath so symlinked temp dirs (/var -> /private/var on macOS) still match.
    return fs.realpathSync(path.resolve(entry)) === fs.realpathSync(path.resolve(fileURLToPath(importMetaUrl)));
  } catch {
    return path.resolve(entry) === path.resolve(fileURLToPath(importMetaUrl));
  }
}
