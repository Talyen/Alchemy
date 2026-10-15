export const BUDGETS = {
  // CI run 38649677123 measured 1,918,020 desktop JS bytes (1,905,416 web)
  // after board collection, the mana dock, and shared battle lighting.
  // Localization adds i18next, React bindings and explicit UI message calls.
  // Reserve 160 KiB for that runtime; catalogs are emitted as local JSON assets.
  // CI measures both renderer editions against this ceiling.
  totalJsMaxBytes: 2050 * 1024,
  // Soft warning at 95% so growth is visible before the gate goes red.
  totalJsWarnBytes: Math.floor(2050 * 1024 * 0.95),
};

export const CHUNK_SIZE_WARNING_KB = 640;
