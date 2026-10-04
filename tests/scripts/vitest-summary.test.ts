import { expect, it } from "vitest";
import { formatVitestSummaryMarkdown, summarizeVitestReport } from "../../scripts/lib/verification/vitest-summary.mjs";

it("keeps an unsuccessful run and its inferred totals when diagnostics are capped or hidden", () => {
  const report = {
    testResults: [
      {
        name: "tests/example.test.ts",
        assertionResults: Array.from({ length: 8 }, (_, index) => ({
          status: "failed",
          fullName: `failure ${index}`,
          failureMessages: [`Error: failure ${index}`],
        })),
      },
    ],
  };
  const summary = summarizeVitestReport(report, { maxFailures: 2 });
  expect(summary.failed).toBe(true);
  expect(summary.numFailedTests).toBe(8);
  expect(summary.failures.map((failure) => failure.title)).toEqual(["failure 0", "failure 1"]);
  expect(formatVitestSummaryMarkdown(summary)).toContain("6 more");
  expect(summarizeVitestReport(report, { maxFailures: 0 })).toMatchObject({
    failed: true,
    numFailedTests: 8,
    failures: [],
  });
});
