#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { publishCiSummary } from "./lib/ci-summary.mjs";
import { writeFailureIndex } from "./lib/playwright-diagnostics.mjs";
import { formatPlaywrightSummaryMarkdown, summarizePlaywrightReport } from "./lib/playwright-summary.mjs";
import { formatVitestSummaryMarkdown, summarizeVitestReport } from "./ci-summarize-vitest.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const DEFAULT_VITEST_REPORT = "reports/vitest-timings.json";
const DEFAULT_PLAYWRIGHT_REPORT = "reports/playwright-results.json";

function publishVitest(reportPath) {
  const resolved = path.resolve(reportPath);
  const summary = fs.existsSync(resolved) ? summarizeVitestReport(JSON.parse(fs.readFileSync(resolved, "utf8"))) : null;
  const markdown = summary ? formatVitestSummaryMarkdown(summary) : `## Vitest\n\n_No report at \`${reportPath}\`._\n`;
  publishCiSummary({
    rootDir: process.cwd(),
    markdown,
    status: summary ? (summary.numFailedTests > 0 ? "failed" : "passed") : "missing-report",
    command: process.env.GITHUB_JOB ? `vitest (${process.env.GITHUB_JOB})` : "vitest",
    artifacts: [path.relative(process.cwd(), resolved)],
    summary: summary ? `Vitest: ${summary.numPassedTests}/${summary.numTotalTests} passed.` : "Vitest report missing.",
    counts: summary
      ? { passed: summary.numPassedTests, failed: summary.numFailedTests, skipped: summary.numPendingTests }
      : undefined,
  });
}

function publishPlaywright(reportPath) {
  const resolved = path.resolve(reportPath);
  const summary = fs.existsSync(resolved)
    ? summarizePlaywrightReport(JSON.parse(fs.readFileSync(resolved, "utf8")))
    : null;
  const markdown = summary
    ? formatPlaywrightSummaryMarkdown(summary)
    : `## Playwright\n\n_No report at \`${reportPath}\`._\n`;
  const failureIndex = writeFailureIndex(process.cwd());
  const exactDigests = (summary?.failures ?? [])
    .map((failure) => failure.digestPath)
    .filter((filePath) => typeof filePath === "string" && fs.existsSync(path.resolve(filePath)));
  publishCiSummary({
    rootDir: process.cwd(),
    markdown,
    status: summary ? (summary.unexpected > 0 ? "failed" : "passed") : "missing-report",
    command: process.env.GITHUB_JOB ? `playwright (${process.env.GITHUB_JOB})` : "playwright",
    artifacts: [
      ...exactDigests.map((filePath) => ({ path: filePath, role: "primary" })),
      ...(failureIndex.failures.length > 0
        ? [{ path: path.relative(process.cwd(), failureIndex.indexPath), role: "primary" }]
        : []),
      { path: path.relative(process.cwd(), resolved), role: "secondary" },
      { path: "playwright-report", role: "secondary" },
      { path: "test-results", role: "secondary" },
    ],
    summary: summary
      ? `Playwright: ${summary.expected} passed, ${summary.unexpected} failed.`
      : "Playwright report missing.",
    counts: summary
      ? { passed: summary.expected, failed: summary.unexpected, skipped: summary.skipped, flaky: summary.flaky }
      : undefined,
  });
}

function printHelp() {
  console.log(`Usage: node scripts/ci-summarize.mjs [vitest|playwright] [reportPath]
  --vitest [path]      Summarize Vitest (default ${DEFAULT_VITEST_REPORT})
  --playwright [path]  Summarize Playwright (default ${DEFAULT_PLAYWRIGHT_REPORT})
  --help               Show this help`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  const hasVitest = args.includes("--vitest") || args.includes("vitest");
  const hasPlaywright = args.includes("--playwright") || args.includes("playwright");
  if (!hasVitest && !hasPlaywright) {
    const first = args[0];
    if (first === "vitest") publishVitest(args[1] ?? DEFAULT_VITEST_REPORT);
    else if (first === "playwright") publishPlaywright(args[1] ?? DEFAULT_PLAYWRIGHT_REPORT);
    else {
      publishVitest(first ?? DEFAULT_VITEST_REPORT);
    }
    return;
  }
  if (hasVitest) {
    const idx = args.indexOf("--vitest");
    const vitestIdx = idx !== -1 ? idx : args.indexOf("vitest");
    const reportPath =
      args[vitestIdx + 1] && !args[vitestIdx + 1].startsWith("--") ? args[vitestIdx + 1] : DEFAULT_VITEST_REPORT;
    publishVitest(reportPath);
  }
  if (hasPlaywright) {
    const idx = args.indexOf("--playwright");
    const pwIdx = idx !== -1 ? idx : args.indexOf("playwright");
    const reportPath =
      args[pwIdx + 1] && !args[pwIdx + 1].startsWith("--") ? args[pwIdx + 1] : DEFAULT_PLAYWRIGHT_REPORT;
    publishPlaywright(reportPath);
  }
}

if (isMainModule(import.meta.url)) main();

export { publishVitest, publishPlaywright };
