import { formatRouteHintLine, routeHintForPath } from "../agent/route-hints.mjs";
import {
  MAX_SUMMARY_FAILURES,
  firstSummaryLine,
  formatSummaryMarkdown,
  missingReportMarkdown,
  readJsonReport,
} from "./report-summary.mjs";

const DEFAULT_REPORT = "reports/vitest-timings.json";

export function summarizeVitestReport(report, options = {}) {
  const maxFailures = options.maxFailures ?? MAX_SUMMARY_FAILURES;
  const rootDir = options.rootDir ?? process.cwd();
  const root = report && typeof report === "object" ? report : {};
  const testResults = Array.isArray(root.testResults) ? root.testResults : [];
  const failures = [];
  const runnerErrors = [];
  if (!Array.isArray(root.testResults)) runnerErrors.push("Invalid Vitest report: missing testResults array");
  for (const fileResult of testResults) {
    if (!fileResult || typeof fileResult !== "object") continue;
    const file = fileResult;
    const fileName = typeof file.name === "string" ? file.name : "unknown";
    const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : [];
    if (file.status === "failed" && !assertions.some((row) => row?.status === "failed")) {
      runnerErrors.push(`${fileName}: ${firstSummaryLine(file.message || "Suite failed before assertions completed")}`);
    }
    for (const assertion of assertions) {
      if (!assertion || typeof assertion !== "object") continue;
      const row = assertion;
      if (row.status !== "failed") continue;
      const messages = Array.isArray(row.failureMessages)
        ? row.failureMessages.filter((m) => typeof m === "string")
        : [];
      failures.push({
        file: fileName,
        title:
          typeof row.fullName === "string" ? row.fullName : typeof row.title === "string" ? row.title : "failed test",
        message: firstSummaryLine(messages[0] ?? ""),
        routeHint: formatRouteHintLine(routeHintForPath(fileName, rootDir)),
      });
    }
  }
  const numFailedTests = Number(root.numFailedTests) || failures.length;
  const numFailedTestSuites = Number(root.numFailedTestSuites) || 0;
  const failed = root.success === false || numFailedTests > 0 || numFailedTestSuites > 0 || runnerErrors.length > 0;
  if (failed && !numFailedTests && !runnerErrors.length)
    runnerErrors.push("Vitest reported a failed run without assertion details.");
  return {
    failed,
    runnerErrors: runnerErrors.slice(0, maxFailures),
    numFailedTestSuites,
    numTotalTests: Number(root.numTotalTests) || 0,
    numPassedTests: Number(root.numPassedTests) || 0,
    numFailedTests,
    numPendingTests: Number(root.numPendingTests) || 0,
    failures: failures.slice(0, maxFailures),
  };
}

export function formatVitestSummaryMarkdown(summary) {
  return formatSummaryMarkdown({
    heading: "## Vitest",
    totals: [
      `- Total: ${summary.numTotalTests}`,
      `- Passed: ${summary.numPassedTests}`,
      `- Failed: ${summary.numFailedTests}`,
      `- Pending: ${summary.numPendingTests}`,
    ],
    runnerErrors: summary.runnerErrors,
    failures: summary.failures,
    renderFailure: (failure) => {
      const rel = failure.file.replaceAll("\\", "/");
      const rendered = [`- \`${rel}\` — **${failure.title}**`];
      if (failure.routeHint) rendered.push(`  - ${failure.routeHint}`);
      if (failure.message) rendered.push(`  - ${failure.message}`);
      return rendered;
    },
    overflowCount: Math.max(0, summary.numFailedTests - summary.failures.length),
    emptyNote: summary.numFailedTests > 0 ? "_Failed tests present but not listed in JSON._" : "_No failed tests._",
  });
}

export function summarizeVitestFile(reportPath = DEFAULT_REPORT) {
  const read = readJsonReport(reportPath);
  if (!read) return missingReportMarkdown("## Vitest", reportPath);
  return formatVitestSummaryMarkdown(summarizeVitestReport(read.data));
}
