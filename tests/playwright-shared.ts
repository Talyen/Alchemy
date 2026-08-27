// Shared CI-sensitive Playwright settings for the browser and desktop configs.
// The performance config is intentionally standalone (on-demand profiling).
import type { ReporterDescription } from "@playwright/test";
import { ensureRunId } from "../scripts/lib/current-run.mjs";
import { resolvePort } from "../scripts/lib/dev-port.mjs";

/** Port contracts live in scripts/lib/dev-port.mjs; re-exported here for TS consumers. */
export { BROWSER_PREVIEW_PORT, ELECTRON_PREVIEW_PORT, PERF_PREVIEW_PORT } from "../scripts/lib/dev-port.mjs";

export function previewPortFromEnv(envName: string, fallback: number): number {
  return resolvePort(envName, fallback);
}

/** Standard strictPort vite server binding shared by all Playwright surfaces. */
export function previewWebServer(
  port: number,
  { mode = "preview" }: { mode?: "dev" | "preview" } = {},
): { command: string; port: number } {
  return {
    command: `npx vite${mode === "dev" ? "" : " preview"} --host 127.0.0.1 --port ${port} --strictPort`,
    port,
  };
}

export interface PlaywrightCiSettingsOptions {
  isCi: boolean;
  /** JSON reporter output used in CI when PLAYWRIGHT_JSON_OUTPUT_NAME is unset. */
  defaultJsonOut: string;
}

export function playwrightCiSettings({ isCi, defaultJsonOut }: PlaywrightCiSettingsOptions): {
  retries: 0 | 1;
  forbidOnly: boolean;
  reporter: ReporterDescription[];
} {
  ensureRunId("playwright");
  const jsonOutputFile = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? defaultJsonOut;
  return {
    retries: isCi ? 1 : 0,
    forbidOnly: isCi,
    // CI: github annotations + compact console + HTML artifact + JSON for step summary.
    reporter: isCi
      ? [
          ["./scripts/lib/playwright-run-reporter.mjs"],
          ["github"],
          ["line"],
          ["html"],
          ["json", { outputFile: jsonOutputFile }],
        ]
      : [["./scripts/lib/playwright-run-reporter.mjs"], ["line"], ["html", { open: "never" }]],
  };
}
