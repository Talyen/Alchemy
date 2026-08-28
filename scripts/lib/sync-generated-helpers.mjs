import path from "node:path";
import { fileURLToPath } from "node:url";

import { syncGeneratedModule } from "./generated-module.mjs";

export function getOptimizedManifestPath(rootDir) {
  return path.join(rootDir, "src", "assets", "optimized", ".asset-hashes.json");
}

export function resolveRootDir(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..");
}

export async function runSyncGenerated({ manifestPath, outputFile, rootDir, check = false, build, onCount, label }) {
  const result = await syncGeneratedModule({ manifestPath, outputFile, check, build });
  const count = onCount(result);
  const relative = path.relative(rootDir, outputFile);
  if (check) {
    console.log(`${label} are current (${count} entries)`);
  } else if (result.wrote) {
    console.log(`Wrote ${count} ${label.toLowerCase()} to ${relative}`);
  } else {
    console.log(`${label} unchanged (${count} entries)`);
  }
  return result;
}
