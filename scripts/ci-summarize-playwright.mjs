#!/usr/bin/env node
// Append a short Playwright failure digest to $GITHUB_STEP_SUMMARY (or stdout).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REPORT = "reports/playwright-results.json";
const MAX_FAILURES = 20;
const MESSAGE_CHARS = 240;

/**
 * @typedef {{ file: string, title: string, message: string, status: string }} PlaywrightFailure
 * @typedef {{
 *   total: number,
 *   expected: number,
 *   unexpected: number,
 *   flaky: number,
 *   skipped: number,
 *   failures: PlaywrightFailure[],
 * }} PlaywrightSummary
 */

/**
 * @param {unknown} suite
 * @param {(spec: Record<string, unknown>) => void} visit
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

/**
 * @param {Record<string, unknown>} spec
 * @returns {string}
 */
function firstErrorMessage(spec) {
  const tests = Array.isArray(spec.tests) ? spec.tests : [];
  for (const test of tests) {
    if (!test || typeof test !== "object") continue;
    const results = Array.isArray(/** @type {Record<string, unknown>} */ (test).results)
      ? /** @type {Record<string, unknown>} */ (test).results
      : [];
    for (const result of results) {
      if (!result || typeof result !== "object") continue;
      const errors = Array.isArray(/** @type {Record<string, unknown>} */ (result).errors)
        ? /** @type {Record<string, unknown>} */ (result).errors
        : [];
      for (const err of errors) {
        if (!err || typeof err !== "object") continue;
        const message = /** @type {Record<string, unknown>} */ (err).message;
        if (typeof message === "string" && message.length > 0) {
          return (message.split("\n")[0] ?? "").slice(0, MESSAGE_CHARS);
        }
      }
    }
  }
  return "";
}

/**
 * @param {unknown} report
 * @param {{ maxFailures?: number }} [options]
 * @returns {PlaywrightSummary}
 */
export function summarizePlaywrightReport(report, options = {}) {
  const maxFailures = options.maxFailures ?? MAX_FAILURES;
  const root = report && typeof report === "object" ? /** @type {Record<string, unknown>} */ (report) : {};
  const stats = root.stats && typeof root.stats === "object" ? /** @type {Record<string, unknown>} */ (root.stats) : {};

  /** @type {PlaywrightFailure[]} */
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
          total += 1;
          const status = /** @type {Record<string, unknown>} */ (test).status;
          if (status === "expected") expected += 1;
          else if (status === "unexpected") unexpected += 1;
          else if (status === "flaky") flaky += 1;
          else if (status === "skipped") skipped += 1;

          if (status === "unexpected" || status === "flaky") {
            const file = typeof spec.file === "string" ? spec.file : "unknown";
            const title = typeof spec.title === "string" ? spec.title : "failed test";
            failures.push({
              file,
              title,
              status: typeof status === "string" ? status : "unexpected",
              message: firstErrorMessage(spec),
            });
          }
        }
      });
    }
  }

  // Prefer Playwright stats when present (includes filtered/skipped edge cases).
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

/**
 * @param {PlaywrightSummary} summary
 * @returns {string}
 */
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
    lines.push(`- \`${rel}\` — **${failure.title}** (${tag})`);
    if (failure.message) lines.push(`  - ${failure.message}`);
  }
  const listed = summary.failures.length;
  const totalBad = summary.unexpected + summary.flaky;
  if (totalBad > listed) {
    lines.push("", `_…and ${totalBad - listed} more._`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} reportPath
 * @returns {string}
 */
export function summarizePlaywrightFile(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return `## Playwright\n\n_No report at \`${reportPath}\`._\n`;
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return formatPlaywrightSummaryMarkdown(summarizePlaywrightReport(report));
}

/**
 * @param {string} markdown
 */
function appendSummary(markdown) {
  const out = process.env.GITHUB_STEP_SUMMARY;
  if (out) {
    fs.appendFileSync(out, markdown);
    return;
  }
  process.stdout.write(markdown);
}

function main() {
  const reportPath = path.resolve(process.argv[2] ?? DEFAULT_REPORT);
  appendSummary(summarizePlaywrightFile(reportPath));
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isDirectRun = entry.length > 0 && fileURLToPath(import.meta.url) === entry;

if (isDirectRun) {
  main();
}
