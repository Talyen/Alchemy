import fs from "node:fs";
import path from "node:path";
import { ensureRunId } from "./current-run.mjs";
import { diagnosticIdentity, failureDigestRelativePath } from "./playwright-diagnostics.mjs";
import { formatRouteHintLine, routeHintForPath } from "../agent/route-hints.mjs";
import { MAX_SUMMARY_FAILURES, firstSummaryLine, formatSummaryMarkdown } from "./report-summary.mjs";

const TEST_OUTCOMES = new Set(["expected", "unexpected", "flaky", "skipped"]);

/**
 * @typedef {{ file: string, line: number, title: string, message: string, status: string, digestPath: string|null, routeHint: string }} PlaywrightFailure
 * @typedef {{ total: number, expected: number, unexpected: number, flaky: number, skipped: number, failures: PlaywrightFailure[], failed: boolean, runnerErrors: string[] }} PlaywrightSummary
 */

function* testsInSuites(suites, parents = [], fileLevel = true) {
  if (!Array.isArray(suites)) return;
  for (const suite of suites) {
    if (!suite || typeof suite !== "object") continue;
    const titles = !fileLevel && typeof suite.title === "string" ? [...parents, suite.title] : parents;
    if (Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        if (!spec || typeof spec !== "object" || !Array.isArray(spec.tests)) continue;
        for (const test of spec.tests) {
          if (test && typeof test === "object") yield { spec, test, titles };
        }
      }
    }
    yield* testsInSuites(suite.suites, titles, false);
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
      if (typeof message === "string" && message.length > 0) return firstSummaryLine(message);
    }
  }
  return "";
}

function reportFile(file, config) {
  if (typeof config?.rootDir !== "string" || typeof config.configFile !== "string") return file;
  // Alchemy's Playwright configs live at the repository root. JSON paths are
  // relative to testDir; anchor through configFile so downloaded CI reports
  // remain portable across checkouts and Windows/Linux path spellings.
  const normalize = (value) => value.replaceAll("\\", "/");
  const directory = path.posix.relative(path.posix.dirname(normalize(config.configFile)), normalize(config.rootDir));
  return path.posix.normalize(path.posix.join(directory, normalize(file)));
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

  for (const { spec, test, titles } of testsInSuites(root.suites)) {
    const status = typeof test.status === "string" ? test.status : "unknown";
    const duration = Array.isArray(test.results)
      ? test.results.reduce((sum, result) => sum + (Number(result?.duration) || 0), 0)
      : 0;
    const testInfo = {
      title: [...titles, typeof spec.title === "string" ? spec.title : "unknown test"].filter(Boolean).join(" > "),
      file: typeof spec.file === "string" ? reportFile(spec.file, root.config) : "unknown",
      line: Number(spec.line) || 0,
      duration,
      status,
      expectedStatus: test.expectedStatus,
      errorMessage: firstResultMessage(test.results),
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
    } else if (status === "expected") passedTests += 1;
  }

  return { allTests, totalTests, passedTests, skippedTests, failedTests, flakyTests };
}

/** Slowest non-skipped tests first, capped for audit tables. */
export function topSlowestTests(allTests, count = 10) {
  return [...allTests]
    .filter((t) => t.status !== "skipped")
    .sort((a, b) => b.duration - a.duration)
    .slice(0, count);
}

export function summarizePlaywrightReport(report, options = {}) {
  const maxFailures = Math.max(0, Math.trunc(options.maxFailures ?? MAX_SUMMARY_FAILURES) || 0);
  const rootDir = options.rootDir ?? process.cwd();
  const runId = options.runId ?? ensureRunId("playwright");
  const root = report && typeof report === "object" ? /** @type {Record<string, unknown>} */ (report) : {};
  const stats = root.stats && typeof root.stats === "object" ? /** @type {Record<string, unknown>} */ (root.stats) : {};
  const failures = [];
  const collected = collectPlaywrightTests(root);
  for (const test of collected.allTests) {
    if (test.status !== "unexpected" && test.status !== "flaky") continue;
    if (failures.length >= maxFailures) break;
    const { file, line, project, status, errorMessage } = test;
    const identity = diagnosticIdentity({ rootDir, file, line, project, title: test.title });
    const digestPath = failureDigestRelativePath(runId, identity.id);
    failures.push({
      file,
      line,
      title: identity.title,
      status,
      message: errorMessage,
      digestPath: fs.existsSync(path.resolve(rootDir, digestPath)) ? digestPath : null,
      routeHint: formatRouteHintLine(routeHintForPath(file, rootDir)),
    });
  }
  const expected = collected.allTests.filter((test) => test.status === "expected").length;
  const unexpected = collected.failedTests.length;
  const flaky = collected.flakyTests.length;
  const skipped = collected.skippedTests;

  const hasStats = Boolean(root.stats && typeof root.stats === "object");
  const runnerErrors = (Array.isArray(root.errors) ? root.errors : []).map((error) =>
    firstSummaryLine(String(error?.message ?? error?.value ?? error)),
  );
  if (root.stats !== undefined && (!root.stats || typeof root.stats !== "object" || Array.isArray(root.stats)))
    runnerErrors.push("Invalid Playwright report: stats must be an object");
  const count = (key, fallback) => {
    if (!hasStats) return fallback;
    const value = stats[key];
    if (value === undefined) return 0;
    if (Number.isSafeInteger(value) && value >= 0) return value;
    runnerErrors.push(`Invalid Playwright report: stats.${key} must be a non-negative integer`);
    return 0;
  };
  const counts = {
    expected: count("expected", expected),
    unexpected: count("unexpected", unexpected),
    flaky: count("flaky", flaky),
    skipped: count("skipped", skipped),
  };
  if (!Array.isArray(root.suites)) runnerErrors.push("Invalid Playwright report: missing suites array");
  const unknown = collected.allTests.filter((test) => !TEST_OUTCOMES.has(test.status)).length;
  if (unknown)
    runnerErrors.push(
      `Invalid Playwright report: ${unknown} ${unknown === 1 ? "test has" : "tests have"} an unknown outcome`,
    );
  return {
    failed: unexpected > 0 || counts.unexpected > 0 || runnerErrors.length > 0,
    runnerErrors: runnerErrors.slice(0, maxFailures),
    total: hasStats ? Object.values(counts).reduce((sum, value) => sum + value, 0) : collected.totalTests,
    ...counts,
    failures,
  };
}

export function formatPlaywrightSummaryMarkdown(summary) {
  return formatSummaryMarkdown({
    heading: "## Playwright",
    totals: [
      `- Total: ${summary.total}`,
      `- Passed: ${summary.expected}`,
      `- Failed: ${summary.unexpected}`,
      `- Flaky: ${summary.flaky}`,
      `- Skipped: ${summary.skipped}`,
    ],
    runnerErrors: summary.runnerErrors,
    failures: summary.failures,
    renderFailure: (failure) => {
      const rel = failure.file.replaceAll("\\", "/");
      const tag = failure.status === "flaky" ? "flaky" : "failed";
      const rendered = [`- \`${rel}:${failure.line}\` — **${failure.title}** (${tag})`];
      if (failure.routeHint) rendered.push(`  - ${failure.routeHint}`);
      if (failure.message) rendered.push(`  - ${failure.message}`);
      if (failure.digestPath) rendered.push(`  - Diagnostic: \`${failure.digestPath}\``);
      return rendered;
    },
    overflowCount: Math.max(0, summary.unexpected + summary.flaky - summary.failures.length),
    emptyNote:
      summary.unexpected > 0 || summary.flaky > 0 ? "_Failures present but not listed in JSON._" : "_No failed tests._",
  });
}
