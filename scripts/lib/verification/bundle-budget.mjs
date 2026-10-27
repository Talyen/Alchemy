export const BUDGETS = {
  // CI run 38649677123 measured 1,918,020 desktop JS bytes (1,905,416 web)
  // after the mana dock and battle presentation additions.
  // Localization adds i18next, React bindings and explicit UI message calls.
  // Reserve 160 KiB for that runtime; catalogs are emitted as local JSON assets.
  // CI run 40413215543 measured 2,138,541 bytes in both desktop editions
  // after combat feedback, enemy traits, and inspection changes. Keep a
  // small margin above that measured eager total.
  totalJsMaxBytes: 2105 * 1024,
  // Soft warning at 95% so growth is visible before the gate goes red.
  totalJsWarnBytes: Math.floor(2105 * 1024 * 0.95),
};

export const CHUNK_SIZE_WARNING_KB = 640;

// Main 22d7e9d20 prepared media: 276.8 MiB video, 97.3 MiB music,
// 23.6 MiB artwork and 4.9 MiB SFX. Include public/ in renderer accounting.
// These are shipping-byte budgets, not decoded RAM or download compression.
export const STORAGE_BUDGETS = Object.freeze({
  renderer: 450 * 1024 * 1024,
  video: 310 * 1024 * 1024,
  music: 110 * 1024 * 1024,
  images: 30 * 1024 * 1024,
  sounds: 8 * 1024 * 1024,
});
