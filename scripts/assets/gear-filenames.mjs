/** Single owner for gear filename conventions (optimizer, barrels, tests). */

export const GEAR_FILE_PATTERN = /^(.+?)\s-\s(Basic|Astral)\.(jpe?g|png)$/i;
export const SLOT_BACKGROUND_PATTERN = /^(.+?)\sSlot\.(jpe?g|png)$/i;

export const GEAR_SLOT_IDS = Object.freeze(["body", "weapon", "accessory", "trinket"]);

function isWebpAsset(name) {
  return name.endsWith(".webp");
}

export function getAssetFiles(manifest) {
  return Object.keys(manifest).filter(isWebpAsset).sort();
}

/**
 * Canonical slug for display names. Apostrophes are stripped first so
 * "Smith's" becomes "smiths" (matching hand-authored crafting/boon targets
 * like "companions-collar"), not "smith-s".
 */
export function slugifyGearName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toGearTarget(displayName, rarity, extension = "webp") {
  return `gear-${slugifyGearName(displayName)}-${rarity.toLowerCase()}.${extension}`;
}
