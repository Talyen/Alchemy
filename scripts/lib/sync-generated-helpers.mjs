import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadManifest } from "./asset-manifest-cache.mjs";
import { writeTextIfChanged } from "./write-text-if-changed.mjs";

export const WEBP_SUFFIX = ".webp";
export const GEAR_PREFIX = "gear-";

export function isWebpAsset(name) {
  return name.endsWith(WEBP_SUFFIX);
}

export function isGearAsset(name) {
  return name.startsWith(GEAR_PREFIX) && name.endsWith(WEBP_SUFFIX);
}

export function getAssetFiles(manifest) {
  return Object.keys(manifest).filter(isWebpAsset).sort();
}

export function getGearFiles(manifest) {
  return Object.keys(manifest).filter(isGearAsset).sort();
}

export function getOptimizedManifestPath(rootDir) {
  return path.join(rootDir, "src", "assets", "optimized", ".asset-hashes.json");
}

export function resolveRootDir(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..");
}

export async function syncGeneratedModule({ manifestPath, outputFile, check = false, build }) {
  const manifest = await loadManifest(manifestPath);
  const result = build(manifest);
  const wrote = await writeTextIfChanged(outputFile, result.content, { check });
  return { ...result, wrote };
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
