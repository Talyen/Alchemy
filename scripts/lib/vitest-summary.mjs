import fs from "node:fs";
import { formatRouteHintLine, routeHintForPath } from "./route-hints.mjs";

const DEFAULT_REPORT = "reports/vitest-timings.json";
const MAX_FAILURES = 5;
const MESSAGE_CHARS = 240;

export function summarizeVitestReport(report, options = {}) {
  const maxFailures = options.maxFailures ?? MAX_FAILURES;
  const rootDir = options.rootDir ?? process.cwd();
  const root = report && typeof report === "object" ? report : {};
  const testResults = Array.isArray(root.testResults) ? root.testResults : [];
  const failures = [];
  for (const fileResult of testResults) {
    if (!fileResult || typeof fileResult !== "object") continue;
    const file = fileResult;
    const fileName = typeof file.name === "string" ? file.name : "unknown";
    const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : [];
    for (const assertion of assertions) {
      if (!assertion || typeof assertion !== "object") continue;
      const row = assertion;
      if (row.status !== "failed") continue;
      const messages = Array.isArray(row.failureMessages)
        ? row.failureMessages.filter((m) => typeof m === "string")
        : [];
      const raw = messages[0] ?? "";
      const firstLine = raw.split("\n")[0] ?? "";
      failures.push({
        file: fileName,
        title:
          typeof row.fullName === "string" ? row.fullName : typeof row.title === "string" ? row.title : "failed test",
        message: firstLine.slice(0, MESSAGE_CHARS),
        routeHint: formatRouteHintLine(routeHintForPath(fileName, rootDir)),
      });
    }
  }
  return {
    numTotalTests: Number(root.numTotalTests) || 0,
    numPassedTests: Number(root.numPassedTests) || 0,
    numFailedTests: Number(root.numFailedTests) || failures.length,
    numPendingTests: Number(root.numPendingTests) || 0,
    failures: failures.slice(0, maxFailures),
  };
}

export function formatVitestSummaryMarkdown(summary) {
  const lines = [
    "## Vitest",
    "",
    `- Total: ${summary.numTotalTests}`,
    `- Passed: ${summary.numPassedTests}`,
    `- Failed: ${summary.numFailedTests}`,
    `- Pending: ${summary.numPendingTests}`,
  ];
  if (summary.failures.length === 0) {
    lines.push(
      "",
      summary.numFailedTests > 0 ? "_Failed tests present but not listed in JSON._" : "_No failed tests._",
    );
    return `${lines.join("\n")}\n`;
  }
  lines.push("", "### Failures", "");
  for (const failure of summary.failures) {
    const rel = failure.file.replaceAll("\\", "/");
    lines.push(`- \`${rel}\` — **${failure.title}**`);
    if (failure.routeHint) lines.push(`  - ${failure.routeHint}`);
    if (failure.message) lines.push(`  - ${failure.message}`);
  }
  if (summary.numFailedTests > summary.failures.length) {
    lines.push("", `_…and ${summary.numFailedTests - summary.failures.length} more._`);
  }
  return `${lines.join("\n")}\n`;
}

export function summarizeVitestFile(reportPath = DEFAULT_REPORT) {
  if (!fs.existsSync(reportPath)) {
    return `## Vitest\n\n_No report at \`${reportPath}\`._\n`;
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return formatVitestSummaryMarkdown(summarizeVitestReport(report));
}
