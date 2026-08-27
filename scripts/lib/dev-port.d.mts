export const BROWSER_PREVIEW_PORT: number;
export const SMOKE_PREVIEW_PORT: number;
export const ELECTRON_PREVIEW_PORT: number;
export const PERF_PREVIEW_PORT: number;
export const STALE_TEST_PORTS: readonly number[];
export function parsePort(value: string | number, label?: string): number;
export function resolvePort(
  envName: string,
  fallback: number,
  env?: Record<string, string | undefined>,
): number;
export function resolveDevPort(env?: Record<string, string | undefined>): number;
