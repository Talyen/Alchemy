import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineScript } from "./lib/script-run.mjs";
import { runWithBalanceServer } from "./lib/balance-report-runner.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

function parseLootSamples(raw) {
  const samples = Number(raw ?? 1000);
  if (!Number.isInteger(samples) || samples < 1) {
    throw new Error(`ALCHEMY_LOOT_SAMPLES must be a positive integer (got ${JSON.stringify(raw ?? "1000")}).`);
  }
  return samples;
}

export async function runLootReport({ samples = parseLootSamples(process.env.ALCHEMY_LOOT_SAMPLES) } = {}) {
  return runWithBalanceServer({
    rootDir,
    command: "npm run balance:loot",
    artifacts: [
      { path: "reports/loot-progression/report.html", role: "primary" },
      { path: "reports/loot-progression/report.json", role: "secondary" },
      { path: "reports/loot-progression/materials.html", role: "secondary" },
      { path: "reports/loot-progression/materials.json", role: "secondary" },
    ],
    summary: (report) =>
      `Loot report: ${report.routes.length} routes × ${report.samplesPerCell} samples per cell (±${(98 / Math.sqrt(report.samplesPerCell)).toFixed(1)} pp sampling error at 95% confidence), plus materials means.`,
    run: async ({
      buildLootBalanceReport,
      renderLootBalanceReport,
      buildMaterialsBalanceReport,
      renderMaterialsBalanceReport,
      stringifyReportJson,
    }) => {
      const report = buildLootBalanceReport(samples);
      const materials = buildMaterialsBalanceReport();
      const directory = resolve(rootDir, "reports/loot-progression");
      console.info(`Loot report: ${resolve(directory, "report.html")}`);
      console.info(`Materials report: ${resolve(directory, "materials.html")}`);
      return {
        report,
        files: [
          {
            directory,
            name: "report.json",
            contents: stringifyReportJson(report),
          },
          { directory, name: "report.html", contents: renderLootBalanceReport(report) },
          {
            directory,
            name: "materials.json",
            contents: stringifyReportJson(materials),
          },
          { directory, name: "materials.html", contents: renderMaterialsBalanceReport(materials) },
        ],
      };
    },
  });
}

defineScript(import.meta.url, () => runLootReport());
