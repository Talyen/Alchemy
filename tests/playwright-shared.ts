import type { ReporterDescription } from "@playwright/test";
import { ensureRunId } from "../scripts/lib/current-run.mjs";
import { resolvePort } from "../scripts/lib/dev-port.mjs";

export { BROWSER_PREVIEW_PORT, ELECTRON_PREVIEW_PORT, PERF_PREVIEW_PORT } from "../scripts/lib/dev-port.mjs";

export function previewPortFromEnv(envName: string, fallback: number): number {
  return resolvePort(envName, fallback);
}

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
