import { ensureRunId } from "../scripts/lib/current-run.mjs";
import { resolvePort } from "../scripts/lib/dev-port.mjs";
import type { ReporterDescription } from "@playwright/test";

export { BROWSER_PREVIEW_PORT, ELECTRON_PREVIEW_PORT, PERF_PREVIEW_PORT } from "../scripts/lib/dev-port.mjs";

export function previewPortFromEnv(envName: string, fallback: number): number {
  return resolvePort(envName, fallback);
}

export function previewWebServer(
  port: number,
  { mode = "preview" }: { mode?: "dev" | "preview" } = {},
): { command: string; port: number } {
  if (!process.env.ALCHEMY_RUN_ID) ensureRunId("playwright");
  return {
    command: `vite${mode === "dev" ? "" : " preview"} --host 127.0.0.1 --port ${port} --strictPort`,
    port,
  };
}

interface PlaywrightCiSettingsOptions {
  isCi: boolean;
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

export const TIMEOUTS = {
  e2e: { local: 20_000, ci: 30_000, actionLocal: 10_000, actionCi: 15_000, global: 600_000 },
  electron: { timeout: 90_000, global: 600_000 },
  performance: { trace: 180_000, normal: 300_000, action: 30_000, global: 1_800_000 },
} as const;
