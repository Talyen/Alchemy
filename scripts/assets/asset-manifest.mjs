import { cardAssets } from "./card-assets.mjs";
import { contentAssets } from "./content-assets.mjs";
import { coreAssets } from "./core-assets.mjs";
import { talentAssets } from "./talent-assets.mjs";
import { validateRegistryEntries } from "../lib/registry-validation.mjs";

export const staticAssets = [...coreAssets, ...cardAssets, ...contentAssets, ...talentAssets];

export async function validateAssetRegistry(entries, { sourceDir } = {}) {
  try {
    await validateRegistryEntries(entries, {
      sourceDir,
      checkExport: true,
      targetPattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.webp$/,
      label: "Asset registry",
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error), { cause: error });
  }
  return entries;
}
