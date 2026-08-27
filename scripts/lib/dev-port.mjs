// Dev / preview port contracts shared by vite.config.ts, Playwright configs, and cleanup scripts.
const DEFAULT_DEV_PORT = 5173;
const MAX_TCP_PORT = 65_535;

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

export function parsePort(value, label = "port") {
  const raw = String(value);
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > MAX_TCP_PORT) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return port;
}

export function resolvePort(envName, fallback, env = process.env) {
  return parsePort(env[envName] ?? fallback, envName);
}

export function resolveDevPort(env = process.env) {
  return resolvePort("ALCHEMY_DEV_PORT", DEFAULT_DEV_PORT, env);
}
