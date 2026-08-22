// Shared CI-sensitive Playwright settings for the browser and desktop configs.
// The performance config is intentionally standalone (on-demand profiling).
import type { ReporterDescription } from "@playwright/test";

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
  const jsonOutputFile = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? defaultJsonOut;
  return {
    retries: isCi ? 1 : 0,
    forbidOnly: isCi,
    // CI: github annotations + compact console + HTML artifact + JSON for step summary.
    reporter: isCi
      ? [["github"], ["line"], ["html"], ["json", { outputFile: jsonOutputFile }]]
      : [["line"], ["html", { open: "never" }]],
  };
}
