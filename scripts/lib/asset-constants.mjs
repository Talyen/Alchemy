import os from "node:os";

export const ASSET_SCHEMA_VERSION = 3;

export const SHARP_DEFAULTS = Object.freeze({
  alphaQuality: 90,
  effort: 6,
  fit: "inside",
  withoutEnlargement: true,
  format: "webp",
});

export const ART_TRANSFORM_CONCURRENCY =
  Number(process.env.ALCHEMY_ASSET_CONCURRENCY ?? "") || Math.min(6, Math.max(1, os.cpus().length - 1) || 6);

export const SOUND_TRANSFORM_CONCURRENCY = 6;
