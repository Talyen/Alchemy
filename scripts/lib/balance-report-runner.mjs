import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeCurrentRun } from "./current-run.mjs";
import { withReportServer } from "./vite-report-server.mjs";

// Shared runner for balance-family reports: Vite SSR load + artifact writes +
// current-run pointer. Keeps run-balance-report and run-loot-report from
// duplicating mkdir/writeFile/writeCurrentRun wiring.
export async function runWithBalanceServer({ rootDir, command, artifacts, summary, run }) {
  return withReportServer(async (server) => {
    const modules = await server.ssrLoadModule("/src/lib/balance/index.ts");
    const result = await run(modules);
    for (const file of result.files) {
      mkdirSync(resolve(file.directory), { recursive: true });
      writeFileSync(resolve(file.directory, file.name), file.contents, "utf8");
    }
    console.info(summary(result));
    writeCurrentRun({ rootDir, status: "passed", command, artifacts, summary: summary(result) });
    return result.report;
  });
}
