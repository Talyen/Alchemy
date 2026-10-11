import { formatRouteHintLine, routeHintForPath } from "../agent/route-hints.mjs";
import { MAX_SUMMARY_FAILURES, firstSummaryLine, formatSummaryMarkdown } from "./report-summary.mjs";

const ASSERTION_OUTCOMES = new Set(["passed", "failed", "pending", "skipped", "todo", "disabled"]);

export function summarizeVitestReport(report, options = {}) {
  const maxFailures = Math.max(0, Math.trunc(options.maxFailures ?? MAX_SUMMARY_FAILURES) || 0);
  const rootDir = options.rootDir ?? process.cwd();
  const root = report && typeof report === "object" ? report : {};
  const testResults = Array.isArray(root.testResults) ? root.testResults : [];
  const failures = [];
  let observedFailures = 0;
  let unknownOutcomes = 0;
  const runnerErrors = [];
  if (!Array.isArray(root.testResults)) runnerErrors.push("Invalid Vitest report: missing testResults array");
  const count = (key) => {
    const value = root[key];
    if (value === undefined) return 0;
    if (Number.isSafeInteger(value) && value >= 0) return value;
    runnerErrors.push(`Invalid Vitest report: ${key} must be a non-negative integer`);
    return 0;
  };
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
      if (!ASSERTION_OUTCOMES.has(row.status)) unknownOutcomes++;
      if (row.status !== "failed") continue;
      observedFailures++;
      if (failures.length >= maxFailures) continue;
      const message = Array.isArray(row.failureMessages) ? row.failureMessages.find((m) => typeof m === "string") : "";
      failures.push({
        file: fileName,
        title:
          typeof row.fullName === "string" ? row.fullName : typeof row.title === "string" ? row.title : "failed test",
        message: firstSummaryLine(message),
        routeHint: formatRouteHintLine(routeHintForPath(fileName, rootDir)),
      });
    }
  }
  if (unknownOutcomes)
    runnerErrors.push(
      `Invalid Vitest report: ${unknownOutcomes} ${unknownOutcomes === 1 ? "assertion has" : "assertions have"} an unknown outcome`,
    );
  const numFailedTests = count("numFailedTests") || observedFailures;
  const numFailedTestSuites = count("numFailedTestSuites");
  const numTotalTests = count("numTotalTests");
  const numPassedTests = count("numPassedTests");
  const numPendingTests = count("numPendingTests");
  const failed = root.success === false || numFailedTests > 0 || numFailedTestSuites > 0 || runnerErrors.length > 0;
  if (failed && !numFailedTests && !runnerErrors.length)
    runnerErrors.push("Vitest reported a failed run without assertion details.");
  return {
    failed,
    runnerErrors: runnerErrors.slice(0, maxFailures),
    numFailedTestSuites,
    numTotalTests,
    numPassedTests,
    numFailedTests,
    numPendingTests,
    failures,
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
