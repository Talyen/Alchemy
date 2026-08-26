import fs from "node:fs";
import path from "node:path";
import { ensureRunId } from "./current-run.mjs";
import { diagnosticIdentity, failureDigestRelativePath } from "./playwright-diagnostics.mjs";
import { formatRouteHintLine, routeHintForPath } from "./route-hints.mjs";

const MAX_FAILURES = 5;
const MESSAGE_CHARS = 240;

/**
 * @typedef {{ file: string, line: number, title: string, message: string, status: string, digestPath: string|null, routeHint: string }} PlaywrightFailure
 * @typedef {{ total: number, expected: number, unexpected: number, flaky: number, skipped: number, failures: PlaywrightFailure[] }} PlaywrightSummary
 */

function traverseSuite(suite, visit) {
  if (!suite || typeof suite !== "object") return;
  const node = /** @type {Record<string, unknown>} */ (suite);
  if (Array.isArray(node.specs)) {
    for (const spec of node.specs) {
      if (spec && typeof spec === "object") visit(/** @type {Record<string, unknown>} */ (spec));
    }
  }
  if (Array.isArray(node.suites)) {
    for (const child of node.suites) traverseSuite(child, visit);
  }
}

/** First non-empty error message line from a results array, capped for display. */
function firstResultMessage(results) {
  if (!Array.isArray(results)) return "";
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const resultNode = /** @type {Record<string, unknown>} */ (result);
    const errors = Array.isArray(resultNode.errors) ? resultNode.errors : [];
    for (const err of errors) {
      if (!err || typeof err !== "object") continue;
      const message = /** @type {Record<string, unknown>} */ (err).message;
      if (typeof message === "string" && message.length > 0)
        return (message.split("\n")[0] ?? "").slice(0, MESSAGE_CHARS);
    }
  }
  return "";
}

function firstErrorMessage(spec) {
  const tests = Array.isArray(spec.tests) ? spec.tests : [];
  for (const test of tests) {
    if (!test || typeof test !== "object") continue;
    const testNode = /** @type {Record<string, unknown>} */ (test);
    const message = firstResultMessage(testNode.results);
    if (message) return message;
  }
  return "";
}

function firstErrorMessageForTest(test) {
  return firstResultMessage(test?.results);
}

/**
 * Flatten Playwright's nested JSON report into the test-level model used by audits.
 * @param {unknown} report
 * @returns {{ allTests: Array<Record<string, unknown>>, totalTests: number, passedTests: number, skippedTests: number, failedTests: Array<Record<string, unknown>>, flakyTests: Array<Record<string, unknown>> }}
 */
export function collectPlaywrightTests(report) {
  const root = report && typeof report === "object" ? /** @type {Record<string, unknown>} */ (report) : {};
  const allTests = [];
  const failedTests = [];
  const flakyTests = [];
  let totalTests = 0;
  let passedTests = 0;
  let skippedTests = 0;

  if (Array.isArray(root.suites)) {
    for (const suite of root.suites) {
      traverseSuite(suite, (spec) => {
        const tests = Array.isArray(spec.tests) ? spec.tests : [];
        for (const test of tests) {
          if (!test || typeof test !== "object") continue;
          const status = typeof test.status === "string" ? test.status : "unknown";
          const duration = Array.isArray(test.results)
            ? test.results.reduce((sum, result) => sum + (Number(result?.duration) || 0), 0)
            : 0;
          const testInfo = {
            title: typeof spec.title === "string" ? spec.title : "unknown test",
            file: typeof spec.file === "string" ? spec.file : "unknown",
            line: Number(spec.line) || 0,
            duration,
            status,
            expectedStatus: test.expectedStatus,
            errorMessage: firstErrorMessageForTest(test),
            retries: Math.max(0, (Array.isArray(test.results) ? test.results.length : 0) - 1),
            project: typeof test.projectName === "string" ? test.projectName : "chromium",
          };
          totalTests += 1;
          allTests.push(testInfo);
          if (status === "skipped") skippedTests += 1;
          else if (status === "unexpected") failedTests.push(testInfo);
          else if (status === "flaky") {
            flakyTests.push(testInfo);
            passedTests += 1;
          } else passedTests += 1;
        }
      });
    }
  }

  return { allTests, totalTests, passedTests, skippedTests, failedTests, flakyTests };
}

export function summarizePlaywrightReport(report, options = {}) {
  const maxFailures = options.maxFailures ?? MAX_FAILURES;
  const rootDir = options.rootDir ?? process.cwd();
  const runId = options.runId ?? ensureRunId("playwright");
  const root = report && typeof report === "object" ? /** @type {Record<string, unknown>} */ (report) : {};
  const stats = root.stats && typeof root.stats === "object" ? /** @type {Record<string, unknown>} */ (root.stats) : {};
  const failures = [];
  let total = 0;
  let expected = 0;
  let unexpected = 0;
  let flaky = 0;
  let skipped = 0;

  if (Array.isArray(root.suites)) {
    for (const suite of root.suites) {
      traverseSuite(suite, (spec) => {
        const tests = Array.isArray(spec.tests) ? spec.tests : [];
        for (const test of tests) {
          if (!test || typeof test !== "object") continue;
          const testNode = /** @type {Record<string, unknown>} */ (test);
          total += 1;
          const status = testNode.status;
          if (status === "expected") expected += 1;
          else if (status === "unexpected") unexpected += 1;
          else if (status === "flaky") flaky += 1;
          else if (status === "skipped") skipped += 1;
          if (status === "unexpected" || status === "flaky") {
            const file = typeof spec.file === "string" ? spec.file : "unknown";
            const line = Number(spec.line) || 0;
            const identity = diagnosticIdentity({
              rootDir,
              file,
              line,
              project: typeof testNode.projectName === "string" ? testNode.projectName : "chromium",
              title: typeof spec.title === "string" ? spec.title : "failed test",
            });
            const digestPath = failureDigestRelativePath(runId, identity.id);
            failures.push({
              file,
              line,
              title: identity.title,
              status: typeof status === "string" ? status : "unexpected",
              message: firstErrorMessage(spec),
              digestPath: fs.existsSync(path.resolve(rootDir, digestPath)) ? digestPath : null,
              routeHint: formatRouteHintLine(routeHintForPath(file, rootDir)),
            });
          }
        }
      });
    }
  }

  const hasStats = Boolean(root.stats && typeof root.stats === "object");
  return {
    total: hasStats
      ? Number(stats.expected ?? 0) +
        Number(stats.unexpected ?? 0) +
        Number(stats.flaky ?? 0) +
        Number(stats.skipped ?? 0)
      : total,
    expected: hasStats ? Number(stats.expected ?? 0) : expected,
    unexpected: hasStats ? Number(stats.unexpected ?? 0) : unexpected,
    flaky: hasStats ? Number(stats.flaky ?? 0) : flaky,
    skipped: hasStats ? Number(stats.skipped ?? 0) : skipped,
    failures: failures.slice(0, maxFailures),
  };
}

export function formatPlaywrightSummaryMarkdown(summary) {
  const lines = [
    "## Playwright",
    "",
    `- Total: ${summary.total}`,
    `- Passed: ${summary.expected}`,
    `- Failed: ${summary.unexpected}`,
    `- Flaky: ${summary.flaky}`,
    `- Skipped: ${summary.skipped}`,
  ];
  if (summary.failures.length === 0) {
    lines.push(
      "",
      summary.unexpected > 0 || summary.flaky > 0 ? "_Failures present but not listed in JSON._" : "_No failed tests._",
    );
    return `${lines.join("\n")}\n`;
  }
  lines.push("", "### Failures", "");
  for (const failure of summary.failures) {
    const rel = failure.file.replaceAll("\\", "/");
    const tag = failure.status === "flaky" ? "flaky" : "failed";
    lines.push(`- \`${rel}:${failure.line}\` — **${failure.title}** (${tag})`);
    if (failure.routeHint) lines.push(`  - ${failure.routeHint}`);
    if (failure.message) lines.push(`  - ${failure.message}`);
    if (failure.digestPath) lines.push(`  - Diagnostic: \`${failure.digestPath}\``);
  }
  const totalBad = summary.unexpected + summary.flaky;
  if (totalBad > summary.failures.length) lines.push("", `_…and ${totalBad - summary.failures.length} more._`);
  return `${lines.join("\n")}\n`;
}

export function summarizePlaywrightFile(reportPath, options = {}) {
  if (!fs.existsSync(reportPath)) return `## Playwright\n\n_No report at \`${reportPath}\`._\n`;
  return formatPlaywrightSummaryMarkdown(
    summarizePlaywrightReport(JSON.parse(fs.readFileSync(reportPath, "utf8")), options),
  );
}
