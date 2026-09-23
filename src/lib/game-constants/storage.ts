export const SAVE_KEY = "alchemy-save-v1";
export const SAVE_RECOVERY_KEY = "alchemy-save-recovery-v1";

export const AUTOSAVE_DEBOUNCE_MS = 500;
export const BATTLE_AUTOSAVE_DEBOUNCE_MS = 2500;
export const AUTOSAVE_MAX_WAIT_MS = 10_000;
// Failure retry cooldown, in ms. Kept equal to the max-wait cap so sustained
// failures cannot bypass the backoff when debounces shrink (e.g. animations
// disabled); split from AUTOSAVE_MAX_WAIT_MS so UX timing and retry backoff
// can diverge later without coupling.
export const AUTOSAVE_RETRY_COOLDOWN_MS = 10_000;
