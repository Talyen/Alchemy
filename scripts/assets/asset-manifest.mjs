import { cardAssets } from "./card-assets.mjs";
import { contentAssets } from "./content-assets.mjs";
import { coreAssets } from "./core-assets.mjs";
import { talentAssets } from "./talent-assets.mjs";
import { access } from "node:fs/promises";
import path from "node:path";
import { kebabToCamel } from "../lib/kebab-to-camel.mjs";

export const staticAssets = [...coreAssets, ...cardAssets, ...contentAssets, ...talentAssets];

/**
 * Validate the hand-maintained asset registries before a transform can write outputs.
 * @param {Array<{source: string, target: string}>} entries
 * @param {{ sourceDir?: string }} [options]
 */
export async function validateAssetRegistry(entries, { sourceDir } = {}) {
  const errors = [];
  const sources = new Map();
  const targets = new Map();
  const exports = new Map();

  for (const entry of entries) {
    const previousSource = sources.get(entry.source);
    if (previousSource)
      errors.push(`Duplicate asset source "${entry.source}" (${previousSource} and ${entry.target}).`);
    sources.set(entry.source, entry.target);

    const previousTarget = targets.get(entry.target);
    if (previousTarget)
      errors.push(`Duplicate asset target "${entry.target}" (${previousTarget} and ${entry.source}).`);
    targets.set(entry.target, entry.source);

    const exportName = kebabToCamel(entry.target.replace(/\.webp$/u, ""));
    const previousExport = exports.get(exportName);
    if (previousExport) errors.push(`Duplicate asset export "${exportName}" (${previousExport} and ${entry.target}).`);
    exports.set(exportName, entry.target);

    if (sourceDir) {
      try {
        await access(path.join(sourceDir, entry.source));
      } catch {
        errors.push(`Missing asset source "${entry.source}" for target "${entry.target}".`);
      }
    }
  }

  if (errors.length > 0) throw new Error(`Asset registry validation failed:\n- ${errors.join("\n- ")}`);
  return entries;
}
