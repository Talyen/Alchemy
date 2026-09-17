import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { writeCurrentRun } from "./lib/current-run.mjs";
import { defineScript } from "./lib/script-run.mjs";
import { withReportServer } from "./lib/vite-report-server.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function runLootReport({ samples = Number(process.env.ALCHEMY_LOOT_SAMPLES ?? 1000) } = {}) {
  return withReportServer(async (server) => {
    const { buildLootBalanceReport, renderLootBalanceReport } = await server.ssrLoadModule("/src/lib/balance/index.ts");
    const report = buildLootBalanceReport(samples);
    const directory = resolve("reports/loot-progression");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "report.json"), JSON.stringify(report, null, 2));
    writeFileSync(resolve(directory, "report.html"), renderLootBalanceReport(report));
    console.info(`Loot report: ${resolve(directory, "report.html")}`);
    writeCurrentRun({
      rootDir,
      status: "passed",
      command: "npm run balance:loot",
      artifacts: [
        { path: "reports/loot-progression/report.html", role: "primary" },
        { path: "reports/loot-progression/report.json", role: "secondary" },
      ],
      summary: `Loot report: ${report.routes.length} routes × ${report.samplesPerCell} samples per cell.`,
    });
    return report;
  });
}

defineScript(import.meta.url, () => runLootReport());
