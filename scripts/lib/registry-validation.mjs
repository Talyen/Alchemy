import { access } from "node:fs/promises";
import path from "node:path";
import { kebabToCamel } from "./kebab-to-camel.mjs";

export async function validateRegistryEntries(
  entries,
  { sourceDir, targetKey = "target", checkExport = false, sourcePattern, targetPattern } = {},
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
      const exportName = kebabToCamel(target.replace(/\.webp$/u, ""));
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

    if (sourceDir && source) {
      try {
        await access(path.join(sourceDir, source));
      } catch {
        errors.push(`Missing asset source "${source}" for target "${target}".`);
      }
    }
  }

  if (errors.length > 0) throw new Error(`Registry validation failed:\n- ${errors.join("\n- ")}`);
  return entries;
}
