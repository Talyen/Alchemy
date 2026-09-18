import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { staticAssets, validateAssetRegistry } from "../assets/asset-manifest.mjs";
import { GEAR_SLOT_IDS } from "./gear-filenames.mjs";
import { getManagedManifestPath } from "./asset-pipeline-runner.mjs";
import { writeTextIfChanged } from "./write-text-if-changed.mjs";

export function getOptimizedManifestPath(rootDir) {
  return getManagedManifestPath(rootDir, "art");
}

/**
 * Strict barrel-side manifest reader. Intentionally stricter than
 * loadManifest (which returns {} on ENOENT/corrupt to trigger a full
 * rebuild): sync must never silently regenerate barrels from an empty set,
 * so malformed/empty manifests and missing required targets throw with the
 * manifest path attached. Filesystem read/stat errors propagate raw so
 * callers (and tests) see the original code/path.
 */
export async function readArtManifest(manifestPath) {
  const raw = await readFile(manifestPath, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`Invalid art manifest "${manifestPath}": malformed JSON.`, { cause });
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) || Object.keys(manifest).length === 0) {
    throw new Error(`Invalid art manifest "${manifestPath}": expected a non-empty object.`);
  }
  for (const [target, entry] of Object.entries(manifest)) {
    if (
      typeof entry !== "string" &&
      !(entry && typeof entry === "object" && !Array.isArray(entry) && typeof entry.hash === "string")
    ) {
      throw new Error(`Invalid art manifest "${manifestPath}": entry "${target}" must contain a string hash.`);
    }
  }
  try {
    await validateAssetRegistry(Object.keys(manifest).map((target) => ({ target })));
  } catch (cause) {
    throw new Error(`Invalid art manifest "${manifestPath}": ${cause.message}`, { cause });
  }
  const requiredTargets = [
    ...staticAssets.map(({ target }) => target),
    ...GEAR_SLOT_IDS.map((id) => `gear-slot-${id}.webp`),
  ];
  const missing = requiredTargets.filter((target) => !Object.hasOwn(manifest, target));
  if (missing.length > 0) {
    throw new Error(`Invalid art manifest "${manifestPath}": missing required targets: ${missing.join(", ")}.`);
  }
  // Parallel stat: Promise.all (not mapPool) so filesystem errors keep their
  // original code/path instead of being wrapped in an AggregateError.
  await Promise.all(
    Object.keys(manifest).map(async (target) => {
      const outputPath = path.join(path.dirname(manifestPath), target);
      if (!(await stat(outputPath)).isFile()) {
        throw new Error(
          `Invalid art manifest "${manifestPath}": entry "${target}" is not a regular file: ${outputPath}`,
        );
      }
    }),
  );
  return manifest;
}

export async function runSyncGenerated({ result, outputFile, rootDir, check = false, onCount, label }) {
  const wrote = await writeTextIfChanged(outputFile, result.content, { check });
  const count = onCount(result);
  const relative = path.relative(rootDir, outputFile);
  if (check) {
    console.log(`${label} are current (${count} entries)`);
  } else if (wrote) {
    console.log(`Wrote ${count} ${label.toLowerCase()} to ${relative}`);
  } else {
    console.log(`${label} unchanged (${count} entries)`);
  }
  return { ...result, wrote };
}
