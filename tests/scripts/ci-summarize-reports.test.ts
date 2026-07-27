import { describe, expect, it } from "vitest";
import {
  formatVitestSummaryMarkdown,
  summarizeVitestFile,
  summarizeVitestReport,
} from "../../scripts/ci-summarize-vitest.mjs";
import {
  formatPlaywrightSummaryMarkdown,
  summarizePlaywrightFile,
  summarizePlaywrightReport,
} from "../../scripts/ci-summarize-playwright.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("ci-summarize-vitest", () => {
  it("extracts failed assertions and formats a short markdown digest", () => {
    const summary = summarizeVitestReport({
      numTotalTests: 3,
      numPassedTests: 2,
      numFailedTests: 1,
      numPendingTests: 0,
      testResults: [
        {
          name: "tests/architecture/eslint-boundary-stacking.test.ts",
          assertionResults: [
            {
              fullName: "eslint architecture boundary stacking > meta screen files lint clean",
              status: "failed",
              failureMessages: ["Error: Test timed out in 5000ms.\n    at ..."],
            },
            { fullName: "ok", status: "passed", failureMessages: [] },
          ],
        },
      ],
    });

    expect(summary.numFailedTests).toBe(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0]?.title).toContain("meta screen files");
    expect(summary.failures[0]?.message).toContain("Test timed out");

    const md = formatVitestSummaryMarkdown(summary);
    expect(md).toContain("## Vitest");
    expect(md).toContain("Failed: 1");
    expect(md).toContain("eslint-boundary-stacking.test.ts");
  });

  it("reports missing files without throwing", () => {
    expect(summarizeVitestFile(path.join(os.tmpdir(), "missing-vitest.json"))).toContain("No report");
  });
});

describe("ci-summarize-playwright", () => {
  it("extracts unexpected and flaky specs", () => {
    const summary = summarizePlaywrightReport({
      stats: { expected: 10, unexpected: 1, flaky: 1, skipped: 2 },
      suites: [
        {
          specs: [
            {
              title: "boots to menu",
              file: "tests/alchemy.spec.ts",
              tests: [
                {
                  status: "unexpected",
                  results: [{ errors: [{ message: "TimeoutError: locator.click\nmore" }] }],
                },
              ],
            },
            {
              title: "flaky save",
              file: "tests/save-persistence.spec.ts",
              tests: [{ status: "flaky", results: [{ errors: [] }] }],
            },
          ],
        },
      ],
    });

    expect(summary.unexpected).toBe(1);
    expect(summary.flaky).toBe(1);
    expect(summary.failures).toHaveLength(2);
    expect(summary.failures[0]?.message).toContain("TimeoutError");

    const md = formatPlaywrightSummaryMarkdown(summary);
    expect(md).toContain("## Playwright");
    expect(md).toContain("boots to menu");
    expect(md).toContain("(flaky)");
  });

  it("reads a report file from disk", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-summary-"));
    const reportPath = path.join(dir, "report.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify({
        stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
        suites: [],
      }),
    );
    expect(summarizePlaywrightFile(reportPath)).toContain("Passed: 1");
  });
});
