export const BUDGETS = {
  // CI run 38649677123 measured 1,918,020 desktop JS bytes (1,905,416 web)
  // after the mana dock and battle presentation additions.
  // Localization adds i18next, React bindings and explicit UI message calls.
  // Reserve 160 KiB for that runtime; catalogs are emitted as local JSON assets.
  // CI run 40023645804 measured 2,105,789 bytes in both desktop editions
  // after the brewing services, room trail and distinct trait icons. Allow
  // another 25 KiB for those additions; retain the eager total-size gate.
  totalJsMaxBytes: 2075 * 1024,
  // Soft warning at 95% so growth is visible before the gate goes red.
  totalJsWarnBytes: Math.floor(2075 * 1024 * 0.95),
};

export const CHUNK_SIZE_WARNING_KB = 640;
