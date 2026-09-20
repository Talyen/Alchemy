/** Preread/total byte budgets per verification route (enforced by `context:hotspots --check`). */

export const ROUTE_CONTEXT_BUDGETS = Object.freeze({
  save: { preread: 18 * 1024, total: 28 * 1024 },
  balance: { preread: 15 * 1024, total: 31 * 1024 },
  performance: { preread: 22 * 1024, total: 35 * 1024 },
  desktop: { preread: 11 * 1024, total: 15 * 1024 },
  "unit-test": { preread: 14 * 1024, total: 25 * 1024 },
  tooling: { preread: 16 * 1024, total: 28 * 1024 },
  assets: { preread: 17 * 1024, total: 25 * 1024 },
  documentation: { preread: 13 * 1024, total: 60 * 1024 },
  runtime: { preread: 30 * 1024, total: 45 * 1024 },
  "browser-test": { preread: 18 * 1024, total: 28 * 1024 },
  unknown: { preread: 9 * 1024, total: 9 * 1024 },
});
