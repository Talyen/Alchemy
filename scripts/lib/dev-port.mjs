// Dev / preview port contracts shared by vite.config.ts, Playwright configs, and cleanup scripts.
export const DEFAULT_DEV_PORT = 5173;

/** Default vite preview ports per E2E surface — one owner for every config, helper, and cleanup list. */
export const BROWSER_PREVIEW_PORT = 4173;
export const SMOKE_PREVIEW_PORT = 4174;
export const ELECTRON_PREVIEW_PORT = 4175;
export const PERF_PREVIEW_PORT = 4176;

/** Preview ports that should not linger after crashed test/smoke runs. */
export const STALE_TEST_PORTS = Object.freeze([
  BROWSER_PREVIEW_PORT,
  SMOKE_PREVIEW_PORT,
  ELECTRON_PREVIEW_PORT,
  PERF_PREVIEW_PORT,
]);

export function resolveDevPort(env = process.env) {
  const raw = env.ALCHEMY_DEV_PORT ?? String(DEFAULT_DEV_PORT);
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ALCHEMY_DEV_PORT: ${raw}`);
  }
  return port;
}
