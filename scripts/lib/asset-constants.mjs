import os from "node:os";

export const ASSET_SCHEMA_VERSION = 4;
export const GEAR_SLOT_IDS = ["body", "weapon", "accessory", "trinket"];

export const SHARP_DEFAULTS = Object.freeze({
  alphaQuality: 90,
  effort: 6,
  fit: "inside",
  withoutEnlargement: true,
  format: "webp",
});

const ciCap = process.env.CI ? 4 : 6;

/**
 * Single concurrency knob for every asset pipeline. ALCHEMY_ASSET_CONCURRENCY
 * overrides all three so a debug value of 1 actually serializes ffmpeg too.
 */
function resolveAssetConcurrency(fallback) {
  const override = Number(process.env.ALCHEMY_ASSET_CONCURRENCY ?? "");
  if (Number.isFinite(override) && override > 0) return Math.floor(override);
  return Math.min(ciCap, fallback);
}

export const ART_TRANSFORM_CONCURRENCY = resolveAssetConcurrency(Math.max(1, os.cpus().length - 1) || ciCap);

export const SOUND_TRANSFORM_CONCURRENCY = resolveAssetConcurrency(4);

export const MUSIC_COPY_CONCURRENCY = resolveAssetConcurrency(4);

/** Single source of truth for art presets; WIDTH/QUALITY below derive from it. */
const ART_PRESETS = Object.freeze({
  card: Object.freeze({ width: 420, quality: 80 }),
  talent: Object.freeze({ width: 420, quality: 82 }),
  boon: Object.freeze({ width: 420, quality: 82 }),
  hero: Object.freeze({ width: 720, quality: 82 }),
  enemy: Object.freeze({ width: 720, quality: 82 }),
  destination: Object.freeze({ width: 900, quality: 84 }),
  gameMode: Object.freeze({ width: 900, quality: 82 }),
  homestead: Object.freeze({ width: 900, quality: 82 }),
  mystery: Object.freeze({ width: 900, quality: 84 }),
  difficulty: Object.freeze({ width: 720, quality: 82 }),
  difficultyPlaceholder: Object.freeze({ width: 720, quality: 60 }),
  resource: Object.freeze({ width: 256, quality: 90 }),
  logo: Object.freeze({ width: 1200, quality: 84 }),
  crafting: Object.freeze({ width: 420, quality: 82 }),
  cursor: Object.freeze({ width: 26, quality: 90 }),
  gear: Object.freeze({ width: 420, quality: 82 }),
});

/** Per-file quality overrides that share the card width. */
const CARD_QUALITY_OVERRIDES = Object.freeze({
  cardHaste: 88,
  cardManaCrystal: 88,
  cardMixedPotion: 84,
  cardPlaceholder: 60,
  enemyPlaceholder: 60,
});

export function artPreset(kind) {
  return ART_PRESETS[kind];
}

export const WIDTH = Object.freeze(
  Object.fromEntries(Object.entries(ART_PRESETS).map(([kind, preset]) => [kind, preset.width])),
);

export const QUALITY = Object.freeze({
  ...Object.fromEntries(Object.entries(ART_PRESETS).map(([kind, preset]) => [kind, preset.quality])),
  ...CARD_QUALITY_OVERRIDES,
});

export const LOUDNORM_FILTER = "loudnorm=I=-16:TP=-1.5:LRA=11";
export const VORBIS_QUALITY = "4";
export const MP3_FALLBACK_SETTINGS = Object.freeze({ codec: "libmp3lame", quality: "4", stripVideo: true });
export const SOUND_ENTRY_OWNERS = Object.freeze({ generated: "generated", curated: "curated" });
// Curated sounds hash a constant on purpose: tuning VORBIS_QUALITY/LOUDNORM_FILTER
// invalidates generated outputs but never curated commits (they ship as-is).
export const CURATED_SOUND_SETTINGS = Object.freeze({ mode: "curated" });

export function soundTransformSettings(sourceExt) {
  if (sourceExt === ".ogg") return { mode: "copy" };
  return {
    mode: "convert",
    codec: "libvorbis",
    quality: VORBIS_QUALITY,
    af: LOUDNORM_FILTER,
    stripVideo: true,
  };
}

export const MUSIC_SETTINGS = Object.freeze({ mode: "copy" });
export const MANIFEST_BASENAME = ".asset-hashes.json";

export const GENERATED_OUTPUTS = Object.freeze({
  assets: "src/lib/game-data/assets.generated.ts",
  gearArt: "src/lib/game-data/gear-art.ts",
  versionMetadata: "src/lib/validation/metadata.generated.ts",
});
