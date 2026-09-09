import { access } from "node:fs/promises";
import path from "node:path";
import { toAssetExportName } from "./kebab-to-camel.mjs";
import { mapPool } from "./map-pool.mjs";

export async function validateRegistryEntries(
  entries,
  { sourceDir, targetKey = "target", checkExport = false, sourcePattern, targetPattern, label = "Registry" } = {},
) {
  const errors = [];
  const sources = new Map();
  const targets = new Map();
  const exports = new Map();

  for (const entry of entries) {
    const source = entry.source;
    const target = entry[targetKey];
    if (source && sources.has(source)) {
      const prev = sources.get(source);
      errors.push(`Duplicate asset source "${source}" (${prev} and ${target}).`);
    }
    if (source) sources.set(source, target);
    if (target && targets.has(target)) {
      const prev = targets.get(target);
      errors.push(`Duplicate asset target "${target}" (${prev} and ${source}).`);
    }
    if (target) targets.set(target, source);

    if (checkExport && target) {
      let exportName;
      try {
        exportName = toAssetExportName(target);
      } catch {
        errors.push(`Invalid target "${target}" (must match ${targetPattern ?? /\.webp$/u}).`);
        continue;
      }
      const prev = exports.get(exportName);
      if (prev) errors.push(`Duplicate asset export "${exportName}" (${prev} and ${target}).`);
      exports.set(exportName, target);
    }

    if (source && sourcePattern && !sourcePattern.test(source)) {
      errors.push(`Unsupported source "${source}" (must match ${sourcePattern}).`);
    }
    if (target && targetPattern && !targetPattern.test(target)) {
      errors.push(`Invalid target "${target}" (must match ${targetPattern}).`);
    }
  }

  if (sourceDir) {
    const missing = await mapPool(
      entries.filter((entry) => entry.source),
      16,
      async (entry) => {
        try {
          await access(path.join(sourceDir, entry.source));
          return null;
        } catch {
          return `Missing asset source "${entry.source}" for target "${entry[targetKey]}".`;
        }
      },
    );
    for (const error of missing) if (error) errors.push(error);
  }

  if (errors.length > 0) {
    throw new Error(`${label} validation failed:\n- ${errors.join("\n- ")}`, { cause: { details: errors } });
  }
  return entries;
}
