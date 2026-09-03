import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";
import { writeCurrentRun } from "./lib/current-run.mjs";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

const server = await createServer({
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});

try {
  const {
    buildBalanceReport,
    evaluateBalanceFindings,
    parseBalanceReportOptions,
    renderBalanceFindingsHtml,
    renderBalanceFindingsJson,
    renderBalanceReportHtml,
    renderBalanceReportJson,
  } = await server.ssrLoadModule("/src/lib/balance.ts");
  const options = parseBalanceReportOptions(process.env);
  const model = buildBalanceReport(options);
  const findings = evaluateBalanceFindings(model, options);
  const reportDir = resolve(process.cwd(), "reports");
  const fullDir = resolve(reportDir, "balance-full");

  mkdirSync(fullDir, { recursive: true });
  writeFileSync(resolve(fullDir, "matrix.html"), renderBalanceReportHtml(model, options), "utf8");
  writeFileSync(resolve(fullDir, "matrix.json"), renderBalanceReportJson(model, options), "utf8");
  writeFileSync(resolve(reportDir, "balance-findings.html"), renderBalanceFindingsHtml(findings, model), "utf8");
  writeFileSync(
    resolve(reportDir, "balance-findings.json"),
    renderBalanceFindingsJson(findings, model, options),
    "utf8",
  );

  console.info(
    `Balance report complete: ${findings.findings.length}/${findings.totalBeforeCap} findings shown (${findings.omitted} omitted).`,
  );
  console.info(`Findings written to ${resolve(reportDir, "balance-findings.html")}`);
  writeCurrentRun({
    rootDir,
    status: "passed",
    command: "npm run balance:sim",
    artifacts: [
      { path: "reports/balance-findings.html", role: "primary" },
      { path: "reports/balance-findings.json", role: "secondary" },
    ],
    summary: `Balance report: ${findings.findings.length}/${findings.totalBeforeCap} findings shown.`,
  });
} finally {
  await server.close();
}
