#!/usr/bin/env node
// Append a short Playwright failure digest to $GITHUB_STEP_SUMMARY (or stdout).
import fs from "node:fs";
import path from "node:path";
import { publishCiSummary } from "./lib/ci-summary.mjs";
import { writeFailureIndex } from "./lib/playwright-diagnostics.mjs";
import {
  collectPlaywrightTests,
  formatPlaywrightSummaryMarkdown,
  summarizePlaywrightFile,
  summarizePlaywrightReport,
} from "./lib/playwright-summary.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

export { collectPlaywrightTests, formatPlaywrightSummaryMarkdown, summarizePlaywrightFile, summarizePlaywrightReport };

const DEFAULT_REPORT = "reports/playwright-results.json";

function main() {
  const reportPath = path.resolve(process.argv[2] ?? DEFAULT_REPORT);
  const markdown = summarizePlaywrightFile(reportPath);
  const summary = fs.existsSync(reportPath)
    ? summarizePlaywrightReport(JSON.parse(fs.readFileSync(reportPath, "utf8")))
    : null;
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
      { path: path.relative(process.cwd(), reportPath), role: "secondary" },
      { path: "playwright-report", role: "secondary" },
      { path: "test-results", role: "secondary" },
    ],
    summary: summary
      ? `Playwright: ${summary.expected} passed, ${summary.unexpected} failed.`
      : "Playwright report missing.",
  });
}

if (isMainModule(import.meta.url)) main();
