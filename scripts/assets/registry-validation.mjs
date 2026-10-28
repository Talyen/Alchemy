import { stat } from "node:fs/promises";
import path from "node:path";
import { VALIDATION_CONCURRENCY } from "./asset-constants.mjs";
import { toAssetExportName } from "../lib/kebab-to-camel.mjs";
import { mapPool } from "../lib/map-pool.mjs";

export async function validateRegistryEntries(
  entries,
  {
    sourceDir,
    allowSourceAliases = false,
    allowMissingSource = false,
    targetKey = "target",
    checkExport = false,
    sourcePattern,
    targetPattern,
    label = "Registry",
    caseInsensitiveDuplicates = false,
    reservedTargets = [],
    reservedMessage = (target) => `Target "${target}" is reserved.`,
  } = {},
) {
  const errors = [];
  const sources = new Map();
  const targets = new Map();
  const exports = new Map();
  const dedupeKey = (value) => (caseInsensitiveDuplicates && typeof value === "string" ? value.toLowerCase() : value);
  const reserved = new Set(reservedTargets.map(dedupeKey));
  const matches = (pattern, value) => {
    const previousIndex = pattern.lastIndex;
    pattern.lastIndex = 0;
    try {
      return pattern.test(value);
    } finally {
      pattern.lastIndex = previousIndex;
    }
  };

  for (const entry of entries) {
    const source = entry.source;
    const target = entry[targetKey];
    const validSource = typeof source === "string" && source.length > 0;
    const validTarget = typeof target === "string" && target.length > 0;
    let invalidTargetReported = false;
    if (!validSource && (!allowMissingSource || source !== undefined))
      errors.push("Asset source must be a non-empty string.");
    if (!validTarget) errors.push(`Asset ${targetKey} must be a non-empty string.`);
    if (!allowSourceAliases && source && sources.has(dedupeKey(source))) {
      const prev = sources.get(dedupeKey(source));
      errors.push(`Duplicate asset source "${source}" (${prev} and ${target}).`);
    }
    if (source) sources.set(dedupeKey(source), target);
    if (target && targets.has(dedupeKey(target))) {
      const prev = targets.get(dedupeKey(target));
      errors.push(`Duplicate asset target "${target}" (${prev} and ${source}).`);
    }
    if (target) targets.set(dedupeKey(target), source);
    if (target && reserved.has(dedupeKey(target))) {
      errors.push(reservedMessage(target));
    }

    if (checkExport && validTarget) {
      let exportName;
      try {
        exportName = toAssetExportName(target);
      } catch {
        errors.push(`Invalid target "${target}" (must match ${targetPattern ?? /\.webp$/u}).`);
        invalidTargetReported = true;
      }
      if (exportName !== undefined) {
        const prev = exports.get(exportName);
        if (prev) errors.push(`Duplicate asset export "${exportName}" (${prev} and ${target}).`);
        exports.set(exportName, target);
      }
    }

    if (validSource && sourcePattern && !matches(sourcePattern, source)) {
      errors.push(`Unsupported source "${source}" (must match ${sourcePattern}).`);
    }
    if (validTarget && targetPattern && !invalidTargetReported && !matches(targetPattern, target)) {
      errors.push(`Invalid target "${target}" (must match ${targetPattern}).`);
    }
  }

  if (sourceDir) {
    const missing = await mapPool(
      entries.filter((entry) => typeof entry.source === "string" && entry.source.length > 0),
      VALIDATION_CONCURRENCY,
      async (entry) => {
        try {
          const source = await stat(path.join(sourceDir, entry.source));
          return source.isFile() ? null : `Asset source "${entry.source}" is not a file.`;
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
