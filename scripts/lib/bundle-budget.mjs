export const BUDGETS = {
  // Roughly 10% growth room above the September 2026 desktop baseline (1632 KiB).
  totalJsMaxBytes: 1800 * 1024,
  // Soft warning at 95% so growth is visible before the gate goes red.
  totalJsWarnBytes: Math.floor(1800 * 1024 * 0.95),
};

export const CHUNK_SIZE_WARNING_KB = 640;
