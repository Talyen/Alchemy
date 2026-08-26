#!/usr/bin/env node
// Append a short Vitest failure digest to $GITHUB_STEP_SUMMARY (or stdout).
import fs from "node:fs";
import path from "node:path";
import { publishCiSummary } from "./lib/ci-summary.mjs";
import { formatRouteHintLine, routeHintForPath } from "./lib/route-hints.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const DEFAULT_REPORT = "reports/vitest-timings.json";
const MAX_FAILURES = 5;
const MESSAGE_CHARS = 240;

/**
 * @typedef {{ file: string, title: string, message: string, routeHint: string }} VitestFailure
 * @typedef {{
 *   numTotalTests: number,
 *   numPassedTests: number,
 *   numFailedTests: number,
 *   numPendingTests: number,
 *   failures: VitestFailure[],
 * }} VitestSummary
 */

/**
 * @param {unknown} report
 * @param {{ maxFailures?: number, rootDir?: string }} [options]
 * @returns {VitestSummary}
 */
export function summarizeVitestReport(report, options = {}) {
  const maxFailures = options.maxFailures ?? MAX_FAILURES;
  const rootDir = options.rootDir ?? process.cwd();
  const root = report && typeof report === "object" ? /** @type {Record<string, unknown>} */ (report) : {};
  const testResults = Array.isArray(root.testResults) ? root.testResults : [];

  /** @type {VitestFailure[]} */
  const failures = [];
  for (const fileResult of testResults) {
    if (!fileResult || typeof fileResult !== "object") continue;
    const file = /** @type {Record<string, unknown>} */ (fileResult);
    const fileName = typeof file.name === "string" ? file.name : "unknown";
    const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : [];
    for (const assertion of assertions) {
      if (!assertion || typeof assertion !== "object") continue;
      const row = /** @type {Record<string, unknown>} */ (assertion);
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

/**
 * @param {VitestSummary} summary
 * @returns {string}
 */
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

/**
 * @param {string} reportPath
 * @returns {string}
 */
export function summarizeVitestFile(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return `## Vitest\n\n_No report at \`${reportPath}\`._\n`;
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return formatVitestSummaryMarkdown(summarizeVitestReport(report));
}

function main() {
  const reportPath = path.resolve(process.argv[2] ?? DEFAULT_REPORT);
  const summary = fs.existsSync(reportPath)
    ? summarizeVitestReport(JSON.parse(fs.readFileSync(reportPath, "utf8")))
    : null;
  const markdown = summary ? formatVitestSummaryMarkdown(summary) : `## Vitest\n\n_No report at \`${reportPath}\`._\n`;
  publishCiSummary({
    rootDir: process.cwd(),
    markdown,
    status: summary ? (summary.numFailedTests > 0 ? "failed" : "passed") : "missing-report",
    command: process.env.GITHUB_JOB ? `vitest (${process.env.GITHUB_JOB})` : "vitest",
    artifacts: [path.relative(process.cwd(), reportPath)],
    summary: summary ? `Vitest: ${summary.numPassedTests}/${summary.numTotalTests} passed.` : "Vitest report missing.",
    counts: summary
      ? { passed: summary.numPassedTests, failed: summary.numFailedTests, skipped: summary.numPendingTests }
      : undefined,
  });
}

const isDirectRun = isMainModule(import.meta.url);

if (isDirectRun) {
  main();
}
