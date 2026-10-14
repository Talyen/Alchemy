export const BUDGETS = {
  // CI run 38350591337 measured 1,871,156 desktop JS bytes after the October
  // run/session and UI changes (2,707 fewer than run 38330649125). The 1840 KiB
  // ceiling adds 20 KiB to the prior limit, retaining about 13 KiB of headroom.
  totalJsMaxBytes: 1840 * 1024,
  // Soft warning at 95% so growth is visible before the gate goes red.
  totalJsWarnBytes: Math.floor(1840 * 1024 * 0.95),
};

export const CHUNK_SIZE_WARNING_KB = 640;
