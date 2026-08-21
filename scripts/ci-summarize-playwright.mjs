#!/usr/bin/env node
// Append a short Playwright failure digest to $GITHUB_STEP_SUMMARY (or stdout).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCurrentRun } from "./lib/current-run.mjs";
import { writeFailureIndex } from "./lib/playwright-diagnostics.mjs";
import {
  formatPlaywrightSummaryMarkdown,
  summarizePlaywrightFile,
  summarizePlaywrightReport,
} from "./lib/playwright-summary.mjs";

export { formatPlaywrightSummaryMarkdown, summarizePlaywrightFile, summarizePlaywrightReport };

const DEFAULT_REPORT = "reports/playwright-results.json";

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
  const markdown = summarizePlaywrightFile(reportPath);
  const summary = fs.existsSync(reportPath)
    ? summarizePlaywrightReport(JSON.parse(fs.readFileSync(reportPath, "utf8")))
    : null;
  const failureIndex = writeFailureIndex(process.cwd());
  const exactDigests = (summary?.failures ?? [])
    .map((failure) => failure.digestPath)
    .filter((filePath) => typeof filePath === "string" && fs.existsSync(path.resolve(filePath)));
  writeCurrentRun({
    rootDir: process.cwd(),
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
  appendSummary(`${markdown}\n_Current run: \`reports/current-run.md\`_\n`);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry.length > 0 && fileURLToPath(import.meta.url) === entry) main();
