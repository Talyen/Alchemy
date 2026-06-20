// Playwright test fixture: fast battle mode + runtime error collection with auto-assert.
import fs from "node:fs/promises";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { enableFastMode } from "../e2e/battle-setup";
import { failOnRuntimeErrors } from "../e2e/errors";

type E2EFixtures = {
  fastBattle: void;
  runtimeErrors: string[];
  autoDiagnostic: void;
};

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
      const handleConsole = (msg: any) => {
        const type = msg.type();
        const text = msg.text();
        if (type === "error" || type === "warning") {
          consoleLogs.push(`[Console ${type}] ${text}`);
        }
      };
      const handlePageError = (err: Error) => {
        consoleLogs.push(`[Runtime Error] ${err.stack ?? err.message}`);
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
            const cleanTitle = testInfo.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
            const dir = path.join(process.cwd(), "test-results", "failures");
            await fs.mkdir(dir, { recursive: true });

            const url = page.url();
            const htmlContent = await page.content().catch(() => "Unable to fetch page HTML");

            const report = [
              `# E2E Test Failure Diagnostic: ${testInfo.title}`,
              `- **Status:** ${testInfo.status}`,
              `- **Duration:** ${testInfo.duration}ms`,
              `- **URL:** [${url}](${url})`,
              `- **File:** [${path.basename(testInfo.file)}](file:///${testInfo.file.replace(/\\/g, "/")})`,
              `\n## Captured Console & Page Errors`,
              consoleLogs.length
                ? consoleLogs.map((l) => `- ${l}`).join("\n")
                : "No console/page errors or warnings captured.",
              `\n## Active HTML Dump (first 10,000 characters)`,
              `\`\`\`html\n${htmlContent.slice(0, 10000)}\n\`\`\``,
            ].join("\n");

            await fs.writeFile(path.join(dir, `${cleanTitle}.md`), report, "utf-8");
            console.log(`\n[Diagnostic] Saved E2E failure digest to test-results/failures/${cleanTitle}.md\n`);
          } catch (err) {
            console.error("Failed to write E2E test failure diagnostics:", err);
          }
        }
      }
    },
    { auto: true },
  ],
});
