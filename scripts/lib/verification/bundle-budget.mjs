export const BUDGETS = {
  // CI run 38649677123 measured 1,918,020 desktop JS bytes (1,905,416 web)
  // after board collection, the mana dock, and shared battle lighting. The
  // 1890 KiB ceiling adds 50 KiB for that UI, retaining about 17 KiB headroom.
  totalJsMaxBytes: 1890 * 1024,
  // Soft warning at 95% so growth is visible before the gate goes red.
  totalJsWarnBytes: Math.floor(1890 * 1024 * 0.95),
};

export const CHUNK_SIZE_WARNING_KB = 640;
