// ============ Storage ============
export const SAVE_KEY = "alchemy-save-v1";

// Default UI slider values (0–100 scale). Used by both defaults.ts (first-boot state) and
// save-schemas.ts (.catch() fallbacks for corrupt saves) so the two always agree.
export const DEFAULT_MUSIC_VOLUME_PCT = 50;
export const DEFAULT_SFX_VOLUME_PCT = 50;
export const DEFAULT_MASTER_VOLUME_PCT = 50;
export const DEFAULT_BRIGHTNESS_PCT = 100;

// The original Knight starter deck IDs from save schema v0. Stored here rather than inside
// each validator so active-run.ts and save-schemas.ts share a single source of truth.
export const LEGACY_STARTER_DECK_IDS = [
  "slash",
  "bash",
  "block",
  "anvil",
  "plate-mail",
  "apple",
  "meteor",
  "blessed-aegis",
] as const;

// Legacy character renames to support saves from before IDs were aligned with data files.
export const LEGACY_CHARACTER_RENAMES = {
  sorcerer: "wizard",
  warden: "ranger",
} as const;
