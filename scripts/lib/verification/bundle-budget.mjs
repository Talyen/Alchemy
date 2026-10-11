export const BUDGETS = {
  // October 2026 UI/lyrics growth measured 1,857,660 bytes in desktop CI before
  // compacting lyric timings; allow 20 KiB above the previous 1800 KiB ceiling.
  totalJsMaxBytes: 1820 * 1024,
  // Soft warning at 95% so growth is visible before the gate goes red.
  totalJsWarnBytes: Math.floor(1820 * 1024 * 0.95),
};

export const CHUNK_SIZE_WARNING_KB = 640;
