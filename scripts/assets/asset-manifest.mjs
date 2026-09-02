import { cardAssets } from "./card-assets.mjs";
import { contentAssets } from "./content-assets.mjs";
import { coreAssets } from "./core-assets.mjs";
import { talentAssets } from "./talent-assets.mjs";
import { validateRegistryEntries } from "../lib/registry-validation.mjs";

export const staticAssets = [...coreAssets, ...cardAssets, ...contentAssets, ...talentAssets];

export async function validateAssetRegistry(entries, { sourceDir } = {}) {
  try {
    await validateRegistryEntries(entries, { sourceDir, checkExport: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace("Registry validation failed:", "Asset registry validation failed:"), {
      cause: error,
    });
  }
  return entries;
}
