import os from "node:os";

export const ASSET_SCHEMA_VERSION = 4;

export const SHARP_DEFAULTS = Object.freeze({
  alphaQuality: 90,
  effort: 6,
  fit: "inside",
  withoutEnlargement: true,
  format: "webp",
});

const ciCap = process.env.CI ? 4 : 6;
export const ART_TRANSFORM_CONCURRENCY =
  Number(process.env.ALCHEMY_ASSET_CONCURRENCY ?? "") || Math.min(ciCap, Math.max(1, os.cpus().length - 1) || ciCap);

export const SOUND_TRANSFORM_CONCURRENCY = Math.min(ciCap, 6);

export const MUSIC_COPY_CONCURRENCY = 4;

export const WIDTH = Object.freeze({
  card: 420,
  talent: 420,
  boon: 420,
  hero: 720,
  enemy: 720,
  destination: 900,
  gameMode: 900,
  homestead: 900,
  mystery: 900,
  difficulty: 720,
  difficultyPlaceholder: 720,
  resource: 256,
  logo: 1200,
  crafting: 420,
  cursor: 26,
  gear: 420,
});

export const QUALITY = Object.freeze({
  card: 80,
  cardHaste: 88,
  cardManaCrystal: 88,
  cardMixedPotion: 84,
  cardPlaceholder: 60,
  talent: 82,
  boon: 82,
  hero: 82,
  enemy: 82,
  enemyPlaceholder: 60,
  destination: 84,
  gameMode: 82,
  homestead: 82,
  mystery: 84,
  difficulty: 82,
  difficultyPlaceholder: 60,
  resource: 90,
  logo: 84,
  crafting: 82,
  cursor: 90,
  gear: 82,
});

export const LOUDNORM_FILTER = "loudnorm=I=-16:TP=-1.5:LRA=11";
export const VORBIS_QUALITY = "4";
export const MP3_FALLBACK_SETTINGS = Object.freeze({ codec: "libmp3lame", quality: "4", stripVideo: true });
export const SOUND_ENTRY_OWNERS = Object.freeze({ generated: "generated", curated: "curated" });
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
