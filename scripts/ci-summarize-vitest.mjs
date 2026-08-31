#!/usr/bin/env node
import path from "node:path";
import {
  publishVitest,
  summarizeVitestReport,
  formatVitestSummaryMarkdown,
  summarizeVitestFile,
  DEFAULT_VITEST_REPORT,
} from "./ci-summarize.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

export { summarizeVitestReport, formatVitestSummaryMarkdown, summarizeVitestFile };

function main() {
  const reportPath = path.resolve(process.argv[2] ?? DEFAULT_VITEST_REPORT);
  publishVitest(reportPath);
}

if (isMainModule(import.meta.url)) main();
