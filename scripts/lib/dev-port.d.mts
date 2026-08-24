export const BROWSER_PREVIEW_PORT: number;
export const SMOKE_PREVIEW_PORT: number;
export const ELECTRON_PREVIEW_PORT: number;
export const PERF_PREVIEW_PORT: number;
export const STALE_TEST_PORTS: readonly number[];
export function resolveDevPort(env?: Record<string, string | undefined>): number;
