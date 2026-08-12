import { cardAssets } from "./card-assets.mjs";
import { contentAssets } from "./content-assets.mjs";
import { coreAssets } from "./core-assets.mjs";

export const staticAssets = [...coreAssets, ...cardAssets, ...contentAssets];
