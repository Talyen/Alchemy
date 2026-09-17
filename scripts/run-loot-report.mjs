import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineScript } from "./lib/script-run.mjs";
import { runWithBalanceServer } from "./lib/balance-report-runner.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function runLootReport({ samples = Number(process.env.ALCHEMY_LOOT_SAMPLES ?? 1000) } = {}) {
  return runWithBalanceServer({
    rootDir,
    command: "npm run balance:loot",
    artifacts: [
      { path: "reports/loot-progression/report.html", role: "primary" },
      { path: "reports/loot-progression/report.json", role: "secondary" },
    ],
    summary: (report) => `Loot report: ${report.routes.length} routes × ${report.samplesPerCell} samples per cell.`,
    run: async ({ buildLootBalanceReport, renderLootBalanceReport }) => {
      const report = buildLootBalanceReport(samples);
      const directory = resolve("reports/loot-progression");
      console.info(`Loot report: ${resolve(directory, "report.html")}`);
      return {
        report,
        files: [
          {
            directory,
            name: "report.json",
            contents: JSON.stringify(report, null, 2),
          },
          { directory, name: "report.html", contents: renderLootBalanceReport(report) },
        ],
      };
    },
  });
}

defineScript(import.meta.url, () => runLootReport());
