#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { publishCiSummary } from "./lib/ci-summary.mjs";
import { writeFailureIndex } from "./lib/playwright-diagnostics.mjs";
import { formatPlaywrightSummaryMarkdown, summarizePlaywrightReport } from "./lib/playwright-summary.mjs";
import { formatVitestSummaryMarkdown, summarizeVitestReport, summarizeVitestFile } from "./lib/vitest-summary.mjs";
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
  --all [vitestPath] [playwrightPath]  Summarize both (defaults as above)
  --help               Show this help`);
}

const REPORT_MODES = new Set(["vitest", "playwright"]);

function isReportPath(value) {
  return typeof value === "string" && !value.startsWith("-") && !REPORT_MODES.has(value);
}

/**
 * Parse the summary dispatcher without making the optional report path depend
 * on the order of flags. Positional paths after --all map to Vitest then
 * Playwright; explicit tool flags always win for their respective report.
 */
export function parseSummaryArgs(args) {
  const selected = { all: false, vitest: false, playwright: false };
  const paths = { vitest: undefined, playwright: undefined };
  const positionalPaths = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--all") {
      selected.all = true;
      continue;
    }

    const dashedMode = arg === "--vitest" || arg === "--playwright";
    const positionalMode = REPORT_MODES.has(arg);
    if (dashedMode || positionalMode) {
      const mode = arg === "--vitest" || arg === "vitest" ? "vitest" : "playwright";
      selected[mode] = true;
      const next = args[index + 1];
      if (isReportPath(next)) {
        paths[mode] = next;
        index += 1;
      }
      continue;
    }

    if (!arg.startsWith("-")) positionalPaths.push(arg);
  }

  if (selected.all) {
    selected.vitest = true;
    selected.playwright = true;
  } else if (!selected.vitest && !selected.playwright) {
    selected.vitest = true;
  }

  for (const mode of ["vitest", "playwright"]) {
    if (selected[mode] && paths[mode] === undefined && positionalPaths.length > 0) {
      paths[mode] = positionalPaths.shift();
    }
  }

  return {
    vitest: selected.vitest,
    playwright: selected.playwright,
    vitestPath: paths.vitest ?? DEFAULT_VITEST_REPORT,
    playwrightPath: paths.playwright ?? DEFAULT_PLAYWRIGHT_REPORT,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  const { vitest, playwright, vitestPath, playwrightPath } = parseSummaryArgs(args);
  if (vitest) publishVitest(vitestPath);
  if (playwright) publishPlaywright(playwrightPath);
}

if (isMainModule(import.meta.url)) main();

export {
  publishVitest,
  publishPlaywright,
  summarizeVitestReport,
  formatVitestSummaryMarkdown,
  summarizeVitestFile,
  DEFAULT_VITEST_REPORT,
  DEFAULT_PLAYWRIGHT_REPORT,
};
