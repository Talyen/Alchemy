import { test as base, expect, type ConsoleMessage } from "@playwright/test";
export { expect } from "@playwright/test";
import { buildFailureDiagnostic, writeFailureDiagnostic } from "../../scripts/lib/playwright-diagnostics.mjs";
import { enableFastMode } from "../e2e/battle-setup";
import { failOnRuntimeErrors } from "../e2e/errors";

interface E2EFixtures {
  fastBattle: void;
  runtimeErrors: string[];
  autoDiagnostic: void;
}

export const test = base.extend<E2EFixtures>({
  fastBattle: async ({ page }, run) => {
    await enableFastMode(page);
    await run();
  },
  runtimeErrors: async ({ page }, run) => {
    const errors = failOnRuntimeErrors(page);
    await run(errors);
    expect(errors).toEqual([]);
  },
  autoDiagnostic: [
    async ({ page }, run, testInfo) => {
      const consoleLogs: string[] = [];
      let droppedLogs = 0;
      const recordLog = (message: string) => {
        if (consoleLogs.length >= 200) {
          consoleLogs.shift();
          droppedLogs += 1;
        }
        consoleLogs.push(message);
      };
      const handleConsole = (msg: ConsoleMessage) => {
        const type = msg.type();
        const text = msg.text();
        if (type === "error" || type === "warning") recordLog(`[Console ${type}] ${text}`);
      };
      const handlePageError = (err: Error) => {
        recordLog(`[Runtime Error] ${err.stack ?? err.message}`);
      };

      page.on("console", handleConsole);
      page.on("pageerror", handlePageError);

      try {
        await run();
      } finally {
        page.off("console", handleConsole);
        page.off("pageerror", handlePageError);

        if (testInfo.status !== testInfo.expectedStatus) {
          try {
            const url = page.url();
            const htmlContent = await page.content().catch(() => "Unable to fetch page HTML");
            const diagnostic = buildFailureDiagnostic({
              rootDir: process.cwd(),
              title: testInfo.title,
              file: testInfo.file,
              line: testInfo.line,
              project: testInfo.project.name,
              status: testInfo.status,
              duration: testInfo.duration,
              url,
              errorMessage: testInfo.error?.message,
              logs: [
                ...(droppedLogs > 0 ? [`[Diagnostic] ${droppedLogs} earlier console entries dropped in memory`] : []),
                ...consoleLogs,
              ],
              html: htmlContent,
            });
            const { digestPath } = writeFailureDiagnostic(process.cwd(), diagnostic);
            console.log(`\n[Diagnostic] Saved E2E failure digest to ${digestPath}\n`);
          } catch (err) {
            console.error("Failed to write E2E test failure diagnostics:", err);
          }
        }
      }
    },
    { auto: true },
  ],
});
