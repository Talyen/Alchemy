import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { staticAssets } from "./assets/asset-manifest.mjs";
import {
  computeContentHash,
  isOutputFresh,
  loadManifest,
  writeManifestIfChanged,
} from "./lib/asset-manifest-cache.mjs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets");
const outputDir = path.join(rootDir, "src", "assets", "optimized");
const manifestPath = path.join(outputDir, ".asset-hashes.json");

/** Bump when sharp pipeline settings or hash inputs change. */
const SCHEMA_VERSION = 1;

const gearAssetWidth = 420;
const gearAssetQuality = 82;

const GEAR_SLOT_IDS = [
  "body",
  "helm",
  "boots",
  "gloves",
  "belt",
  "main-hand",
  "off-hand",
  "amulet",
  "left-ring",
  "right-ring",
];

const GEAR_SLOT_BACKGROUND_NAME_TO_ID = {
  amulet: "amulet",
  belt: "belt",
  body: "body",
  boots: "boots",
  gloves: "gloves",
  helm: "helm",
  "left ring": "left-ring",
  "main hand": "main-hand",
  "off-hand": "off-hand",
  "right ring": "right-ring",
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

async function optimizeAsset({ source, target, width, quality }, storedHash) {
  const sourcePath = path.join(sourceDir, source);
  const outputPath = path.join(outputDir, target);

  try {
    await stat(sourcePath);
  } catch {
    return { message: `${target} skipped (missing source)`, hash: null };
  }

  const settings = artTransformSettings({ width, quality });
  const expectedHash = await computeContentHash(sourcePath, settings, SCHEMA_VERSION);
  const isFresh = await isOutputFresh(outputPath, storedHash, expectedHash);
  if (isFresh) {
    return { message: `${target} already up to date`, hash: expectedHash };
  }

  await sharp(sourcePath)
    .resize({ width, fit: "inside", withoutEnlargement: true })
    .webp({ quality, alphaQuality: 90, effort: 6 })
    .toFile(outputPath);

  return { message: `${target} optimized`, hash: expectedHash };
}

function validateAssetTargets(assetEntries) {
  const seenTargets = new Map();
  for (const asset of assetEntries) {
    const previousSource = seenTargets.get(asset.target);
    if (previousSource) {
      throw new Error(
        `Duplicate optimized asset target "${asset.target}" from "${previousSource}" and "${asset.source}".`,
      );
    }
    seenTargets.set(asset.target, asset.source);
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const gearAssets = await discoverGearAssets();
  const gearSlotBackgrounds = await discoverGearSlotBackgrounds();
  const allAssets = [...staticAssets, ...gearAssets, ...gearSlotBackgrounds];
  validateAssetTargets(allAssets);

  const previousManifest = await loadManifest(manifestPath);
  /** @type {Record<string, string>} */
  const nextManifest = {};
  const results = [];

  for (const asset of allAssets) {
    const { message, hash } = await optimizeAsset(asset, previousManifest[asset.target]);
    results.push(message);
    if (hash) {
      nextManifest[asset.target] = hash;
    }
  }

  await writeManifestIfChanged(manifestPath, nextManifest);

  console.log(
    `Optimized ${results.length} art assets (${gearAssets.length} gear, ${gearSlotBackgrounds.length} gear slot backgrounds).`,
  );
}

main().catch((error) => {
  console.error("Asset optimization failed.");
  console.error(error);
  process.exitCode = 1;
});
