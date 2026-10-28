export const BUDGETS = {
  // CI run 40565352710 measured 2,168,713 web and 2,177,976 desktop JS bytes
  // (uncompressed). Allow about 10% growth above the larger build before failing.
  totalJsMaxBytes: 2350 * 1024,
  // Warn around 5% growth above the measured desktop build.
  totalJsWarnBytes: Math.floor(2350 * 1024 * 0.95),
};

export const CHUNK_SIZE_WARNING_KB = 640;

// CI 40614810398 measured 422.5 MiB video and 554.8 MiB renderer after
// adding three bosses' idle variants. Allow about 10% growth for those totals.
// Include public/ in renderer accounting.
// These are shipping-byte budgets, not decoded RAM or download compression.
export const STORAGE_BUDGETS = Object.freeze({
  renderer: 610 * 1024 * 1024,
  video: 465 * 1024 * 1024,
  music: 110 * 1024 * 1024,
  images: 30 * 1024 * 1024,
  sounds: 8 * 1024 * 1024,
});
