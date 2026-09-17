import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineScript } from "./lib/script-run.mjs";
import { runWithBalanceServer } from "./lib/balance-report-runner.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

export async function runBalanceReport(env = process.env) {
  return runWithBalanceServer({
    rootDir,
    command: "npm run balance:sim",
    artifacts: [
      { path: "reports/balance-findings.html", role: "primary" },
      { path: "reports/balance-findings.json", role: "secondary" },
    ],
    summary: ({ findings }) => `Balance report: ${findings.findings.length}/${findings.totalBeforeCap} findings shown.`,
    run: async ({
      buildBalanceReport,
      evaluateBalanceFindings,
      parseBalanceReportOptions,
      renderBalanceFindingsHtml,
      renderBalanceFindingsJson,
      renderBalanceReportHtml,
      renderBalanceReportJson,
    }) => {
      const options = parseBalanceReportOptions(env);
      const model = buildBalanceReport(options);
      const findings = evaluateBalanceFindings(model, options);
      const reportDir = resolve(process.cwd(), "reports");
      const fullDir = resolve(reportDir, "balance-full");
      console.info(
        `Balance report complete: ${findings.findings.length}/${findings.totalBeforeCap} findings shown (${findings.omitted} omitted).`,
      );
      console.info(`Findings written to ${resolve(reportDir, "balance-findings.html")}`);
      return {
        report: { model, findings },
        findings,
        files: [
          { directory: fullDir, name: "matrix.html", contents: renderBalanceReportHtml(model, options) },
          { directory: fullDir, name: "matrix.json", contents: renderBalanceReportJson(model, options) },
          {
            directory: reportDir,
            name: "balance-findings.html",
            contents: renderBalanceFindingsHtml(findings, model),
          },
          {
            directory: reportDir,
            name: "balance-findings.json",
            contents: renderBalanceFindingsJson(findings, model, options),
          },
        ],
      };
    },
  });
}

defineScript(import.meta.url, () => runBalanceReport());
