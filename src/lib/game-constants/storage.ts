// ============ Storage ============
export const SAVE_KEY = "alchemy-save-v1";

// Autosave debounce. Battle-screen commits are the highest-frequency writes, so
// they use a longer quiet-gap debounce to avoid full-save serialization hitches
// every ~500ms; the freshest battle state is still persisted for crash-resume.
// The max-wait bounds the crash window: continuous play resets the quiet-gap
// timer, but dirty state is always flushed once this long after the first
// unsaved commit.
export const AUTOSAVE_DEBOUNCE_MS = 500;
export const BATTLE_AUTOSAVE_DEBOUNCE_MS = 2500;
export const AUTOSAVE_MAX_WAIT_MS = 10_000;

// Default UI slider values (0–100 scale). Used by both defaults.ts (first-boot state) and
// save-schemas.ts (.catch() fallbacks for corrupt saves) so the two always agree.
export const DEFAULT_MUSIC_VOLUME_PCT = 50;
export const DEFAULT_SFX_VOLUME_PCT = 50;
export const DEFAULT_MASTER_VOLUME_PCT = 50;
export const DEFAULT_BRIGHTNESS_PCT = 100;
