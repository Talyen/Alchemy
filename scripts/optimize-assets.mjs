import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { staticAssets, validateAssetRegistry } from "./assets/asset-manifest.mjs";
import {
  isOutputFresh,
  processManifestEntries,
  removeOrphanOutputs,
  resolveSourceHash,
} from "./lib/asset-manifest-cache.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets");
const outputDir = path.join(rootDir, "src", "assets", "optimized");
const manifestPath = path.join(outputDir, ".asset-hashes.json");
const MANIFEST_BASENAME = ".asset-hashes.json";

/** Bump when sharp pipeline settings, hash inputs, or manifest entry shape change. */
const SCHEMA_VERSION = 2;
const TRANSFORM_CONCURRENCY = 6;

const gearAssetWidth = 420;
const gearAssetQuality = 82;

const GEAR_SLOT_IDS = ["body", "weapon", "accessory", "trinket"];

const GEAR_SLOT_BACKGROUND_NAME_TO_ID = {
  accessory: "accessory",
  body: "body",
  trinket: "trinket",
  weapon: "weapon",
};

function slugifyGearName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function discoverGearAssets() {
  const gearDir = path.join(sourceDir, "Gear");
  let entries;
  try {
    entries = await readdir(gearDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(.+?)\s-\s(Basic|Astral)\.(jpe?g|png)$/i);
    if (!match) {
      if (!entry.name.toLowerCase().includes("placeholder")) {
        console.warn(`[gear] Skipping malformed gear file: ${entry.name}`);
      }
      continue;
    }
    const [, displayName, rarity] = match;
    discovered.push({
      source: `Gear/${entry.name}`,
      target: `gear-${slugifyGearName(displayName)}-${rarity.toLowerCase()}.webp`,
      width: gearAssetWidth,
      quality: gearAssetQuality,
    });
  }
  return discovered;
}

async function discoverGearSlotBackgrounds() {
  const slotDir = path.join(sourceDir, "Gear", "Gear Slot Backgrounds");
  let entries;
  try {
    entries = await readdir(slotDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const discovered = [];
  const foundSlotIds = new Set();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(.+?)\sSlot\.(jpe?g|png)$/i);
    if (!match) {
      console.warn(`[gear-slot] Skipping malformed slot background file: ${entry.name}`);
      continue;
    }
    const displayName = match[1].trim().toLowerCase();
    const slotId = GEAR_SLOT_BACKGROUND_NAME_TO_ID[displayName];
    if (!slotId) {
      console.warn(`[gear-slot] Unknown slot background name: ${match[1]}`);
      continue;
    }
    foundSlotIds.add(slotId);
    discovered.push({
      source: `Gear/Gear Slot Backgrounds/${entry.name}`,
      target: `gear-slot-${slotId}.webp`,
      width: gearAssetWidth,
      quality: gearAssetQuality,
    });
  }

  for (const slotId of GEAR_SLOT_IDS) {
    if (!foundSlotIds.has(slotId)) {
      console.warn(`[gear-slot] Missing background art for slot: ${slotId}`);
    }
  }

  return discovered;
}

function artTransformSettings({ width, quality }) {
  return {
    width,
    quality,
    alphaQuality: 90,
    effort: 6,
    fit: "inside",
    withoutEnlargement: true,
    format: "webp",
  };
}

/**
 * @param {{ source: string, target: string, width: number, quality: number }} asset
 * @param {import("./lib/asset-manifest-cache.mjs").ManifestEntry | undefined} storedEntry
 */
async function optimizeAsset(asset, storedEntry) {
  const sourcePath = path.join(sourceDir, asset.source);
  const outputPath = path.join(outputDir, asset.target);

  let sourceEntry;
  try {
    sourceEntry = await resolveSourceHash(
      sourcePath,
      artTransformSettings({ width: asset.width, quality: asset.quality }),
      SCHEMA_VERSION,
      storedEntry,
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { message: `${asset.target} missing source`, hash: null, missing: true };
    }
    throw error;
  }

  const isFresh = await isOutputFresh(outputPath, storedEntry, sourceEntry.hash);
  if (isFresh) {
    return { message: `${asset.target} already up to date`, entry: sourceEntry, missing: false };
  }

  await sharp(sourcePath)
    .resize({ width: asset.width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: asset.quality, alphaQuality: 90, effort: 6 })
    .toFile(outputPath);

  return { message: `${asset.target} optimized`, entry: sourceEntry, missing: false };
}

export async function optimizeAssets() {
  await mkdir(outputDir, { recursive: true });

  const gearAssets = await discoverGearAssets();
  const gearSlotBackgrounds = await discoverGearSlotBackgrounds();
  const allAssets = [...staticAssets, ...gearAssets, ...gearSlotBackgrounds];
  await validateAssetRegistry(allAssets, { sourceDir });

  const { results, nextManifest } = await processManifestEntries({
    entries: allAssets,
    manifestPath,
    concurrency: TRANSFORM_CONCURRENCY,
    processEntry: optimizeAsset,
  });

  const missing = results.filter((result) => result.missing);
  for (const result of missing) {
    console.error(`Missing art source for ${result.item.target}: ${result.item.source}`);
  }

  if (missing.length === 0) {
    const removed = await removeOrphanOutputs(outputDir, new Set(Object.keys(nextManifest)), {
      manifestBasename: MANIFEST_BASENAME,
      label: "optimized asset",
    });
    if (removed > 0) {
      console.log(`Removed ${removed} orphan optimized assets.`);
    }
  }

  console.log(
    `Optimized ${results.length} art assets (${gearAssets.length} gear, ${gearSlotBackgrounds.length} gear slot backgrounds).`,
  );
  return { ok: missing.length === 0, missing };
}

if (isMainModule(import.meta.url)) {
  optimizeAssets()
    .then(({ ok }) => {
      if (!ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error("Asset optimization failed.");
      console.error(error);
      process.exitCode = 1;
    });
}
