import { describe, expect, it, vi } from "vitest";
import {
  formatVitestSummaryMarkdown,
  summarizeVitestFile,
  summarizeVitestReport,
} from "../../scripts/ci-summarize-vitest.mjs";
import { parseSummaryArgs } from "../../scripts/ci-summarize.mjs";
import {
  collectPlaywrightTests,
  formatPlaywrightSummaryMarkdown,
  summarizePlaywrightFile,
  summarizePlaywrightReport,
} from "../../scripts/lib/playwright-summary.mjs";
import { createRunId, ensureRunId, writeCurrentRun } from "../../scripts/lib/current-run.mjs";
import {
  buildFailureDiagnostic,
  diagnosticIdentity,
  MAX_DIAGNOSTIC_BYTES,
  writeFailureDiagnostic,
} from "../../scripts/lib/playwright-diagnostics.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatRecentRun, parseShowRunsArgs, readRecentRuns } from "../../scripts/show-runs.mjs";
import PlaywrightRunReporter from "../../scripts/lib/playwright-run-reporter.mjs";

describe("ci-summarize-vitest", () => {
  it("resolves defaults and positional paths for single and combined modes", () => {
    expect(parseSummaryArgs(["--vitest"])).toMatchObject({
      vitest: true,
      playwright: false,
      vitestPath: "reports/vitest-timings.json",
    });
    expect(parseSummaryArgs(["playwright", "reports/custom-playwright.json"])).toMatchObject({
      vitest: false,
      playwright: true,
      playwrightPath: "reports/custom-playwright.json",
    });
    expect(parseSummaryArgs(["--all", "reports/custom-vitest.json", "reports/custom-playwright.json"])).toEqual({
      vitest: true,
      playwright: true,
      vitestPath: "reports/custom-vitest.json",
      playwrightPath: "reports/custom-playwright.json",
    });
  });

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
    expect(md).toContain("routes:");
  });

  it("reports missing files without throwing", () => {
    expect(summarizeVitestFile(path.join(os.tmpdir(), "missing-vitest.json"))).toContain("No report");
  });

  it("caps the default Vitest failure list", () => {
    const testResults = Array.from({ length: 6 }, (_, index) => ({
      name: `tests/failure-${index}.test.ts`,
      assertionResults: [{ fullName: `failure ${index}`, status: "failed", failureMessages: ["Error: failure"] }],
    }));
    const summary = summarizeVitestReport({
      numTotalTests: 6,
      numPassedTests: 0,
      numFailedTests: 6,
      numPendingTests: 0,
      testResults,
    });
    expect(summary.failures).toHaveLength(5);
  });
});

describe("ci-summarize-playwright", () => {
  it("prints a self-identifying final summary", () => {
    const priorRunId = process.env.ALCHEMY_RUN_ID;
    process.env.ALCHEMY_RUN_ID = "playwright-reporter-run";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const reporter = new PlaywrightRunReporter();
      reporter.onBegin(
        {},
        {
          allTests: () =>
            (["expected", "unexpected", "flaky", "skipped"] as const).map((outcome) => ({ outcome: () => outcome })),
        },
      );
      reporter.onEnd();
      expect(log).toHaveBeenCalledWith("Playwright run: playwright-reporter-run");
      expect(log).toHaveBeenCalledWith(
        "playwright — 1 passed, 1 failed, 1 flaky, 1 skipped (run playwright-reporter-run)",
      );
    } finally {
      log.mockRestore();
      if (priorRunId === undefined) delete process.env.ALCHEMY_RUN_ID;
      else process.env.ALCHEMY_RUN_ID = priorRunId;
    }
  });

  it("shares the flattened test model with the E2E audit", () => {
    const model = collectPlaywrightTests({
      suites: [
        {
          specs: [
            {
              title: "slow save",
              file: "tests/save.spec.ts",
              line: 12,
              tests: [{ status: "expected", results: [{ duration: 42 }] }],
            },
          ],
        },
      ],
    });
    expect(model.totalTests).toBe(1);
    expect(model.passedTests).toBe(1);
    expect(model.allTests[0]).toMatchObject({ title: "slow save", duration: 42, status: "expected" });
  });

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
    expect(md).toContain("routes:");
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

  it("caps failure details while retaining the total count", () => {
    const suites = Array.from({ length: 4 }, (_, index) => ({
      specs: [
        {
          title: `failure ${index}`,
          file: `tests/failure-${index}.spec.ts`,
          tests: [{ status: "unexpected", results: [{ errors: [{ message: "TimeoutError: click\nstack" }] }] }],
        },
      ],
    }));
    const summary = summarizePlaywrightReport(
      { stats: { expected: 0, unexpected: 4, flaky: 0, skipped: 0 }, suites },
      { maxFailures: 2 },
    );

    expect(summary.unexpected).toBe(4);
    expect(summary.failures).toHaveLength(2);
    expect(formatPlaywrightSummaryMarkdown(summary)).toContain("and 2 more");
  });

  it("does not advertise a missing fixture diagnostic", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pw-summary-no-digest-"));
    try {
      const summary = summarizePlaywrightReport(
        {
          stats: { expected: 0, unexpected: 1, flaky: 0, skipped: 0 },
          suites: [
            {
              specs: [
                {
                  title: "raw animation canary",
                  file: "tests/draw-discard-animations.spec.ts",
                  line: 10,
                  tests: [{ status: "unexpected", projectName: "chromium", results: [{ errors: [] }] }],
                },
              ],
            },
          ],
        },
        { rootDir: root, runId: "no-digest-run" },
      );

      expect(summary.failures[0]?.digestPath).toBeNull();
      expect(formatPlaywrightSummaryMarkdown(summary)).not.toContain("Diagnostic:");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("current-run pointer", () => {
  it("writes a compact machine-readable and markdown pointer", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "current-run-"));
    try {
      const paths = writeCurrentRun({
        rootDir: root,
        runId: "verify-fixture-run",
        commit: "abc123",
        status: "failed",
        command: "vitest",
        artifacts: [
          { path: "reports/summary.md", role: "primary" },
          { path: "reports/raw", role: "secondary" },
        ],
        summary: "First failure is in the save route.",
        counts: { passed: 2, failed: 1 },
      });
      const json = JSON.parse(fs.readFileSync(paths.jsonPath, "utf8"));
      const markdown = fs.readFileSync(paths.markdownPath, "utf8");

      expect(json).toMatchObject({
        commit: "abc123",
        runId: "verify-fixture-run",
        status: "failed",
        command: "vitest",
        artifacts: [
          { path: "reports/summary.md", role: "primary", existsAtWrite: false },
          { path: "reports/raw", role: "secondary", existsAtWrite: false },
        ],
      });
      expect(json.dirtyPaths).toEqual([]);
      expect(json.counts).toEqual({ passed: 2, failed: 1 });
      expect(fs.existsSync(paths.runJsonPath)).toBe(true);
      expect(fs.readFileSync(paths.runJsonPath, "utf8")).toBe(fs.readFileSync(paths.jsonPath, "utf8"));
      expect(markdown).toContain("Run: `verify-fixture-run`");
      expect(markdown).toContain("## Primary evidence");
      expect(markdown).toContain("## Secondary drill-down");
      expect(markdown).toContain("missing when pointer was written");
      expect(markdown).toContain("First failure is in the save route.");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates deterministic IDs, reuses supplied IDs, and shows recent evidence state", () => {
    expect(createRunId("Verify Changed", { now: new Date("2026-08-24T15:47:49Z"), pid: 42, suffix: "abc123" })).toBe(
      "verify-changed-20260824t154749z-42-abc123",
    );
    const env: NodeJS.ProcessEnv = { ALCHEMY_RUN_ID: "Chosen Run" };
    expect(ensureRunId("ignored", env)).toBe("chosen-run");
    const generatedEnv: NodeJS.ProcessEnv = {};
    expect(ensureRunId("verify", generatedEnv)).toMatch(/^verify-\d{8}t\d{6}z-\d+-[a-z0-9]+$/u);
    expect(generatedEnv.ALCHEMY_RUN_ID).toMatch(/^verify-\d{8}t\d{6}z-\d+-[a-z0-9]+$/u);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "run-history-"));
    try {
      const evidence = path.join(root, "reports/evidence.md");
      fs.mkdirSync(path.dirname(evidence), { recursive: true });
      fs.writeFileSync(evidence, "failure");
      writeCurrentRun({
        rootDir: root,
        runId: "older-run",
        status: "failed",
        command: "vitest",
        artifacts: [{ path: evidence, role: "primary" }],
        summary: "save test failed",
      });
      writeCurrentRun({
        rootDir: root,
        runId: "newer-run",
        status: "passed",
        command: "verify",
        summary: "all steps passed",
      });

      expect(parseShowRunsArgs(["--last", "1", "--status", "failed"])).toEqual({ last: 1, status: "failed" });
      const failed = readRecentRuns(root, { last: 1, status: "failed" });
      expect(failed).toHaveLength(1);
      expect(formatRecentRun(root, failed[0] ?? {})).toContain("evidence available");
      fs.unlinkSync(evidence);
      expect(formatRecentRun(root, failed[0] ?? {})).toContain("evidence pruned/missing");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("Playwright failure diagnostics", () => {
  it("bounds warning floods and accessibility output", () => {
    const diagnostic = buildFailureDiagnostic({
      runId: "playwright-context-run",
      rootDir: process.cwd(),
      title: "fails with a warning flood",
      file: "tests/example.spec.ts",
      line: 17,
      project: "chromium",
      status: "failed",
      duration: 123,
      url: "http://127.0.0.1:4173",
      errorMessage: "TimeoutError: expected button to be visible",
      logs: Array.from({ length: 200 }, (_, index) => `${index} ${"warning ".repeat(300)}`),
      accessibilitySnapshot: '- main "Alchemy":\n' + '  - button "Play"\n'.repeat(20_000),
    });

    expect(Buffer.byteLength(diagnostic.markdown, "utf8")).toBeLessThanOrEqual(MAX_DIAGNOSTIC_BYTES);
    expect(diagnostic.omittedLogs).toBeGreaterThan(0);
    expect(diagnostic.omittedContextBytes).toBeGreaterThan(0);
    expect(diagnostic.contextKind).toBe("accessibility");
    expect(diagnostic.markdown).toContain("Accessibility snapshot");
    expect(diagnostic.markdown).toContain("Run: playwright-context-run");
    expect(diagnostic.markdown).toContain("entries omitted");
  });

  it("uses bounded HTML only when accessibility capture is unavailable", () => {
    const diagnostic = buildFailureDiagnostic({
      runId: "playwright-fallback-run",
      title: "page closed",
      file: "tests/example.spec.ts",
      status: "failed",
      duration: 10,
      logs: ["Accessibility snapshot unavailable"],
      htmlFallback: "<main>fallback</main>",
    });

    expect(diagnostic.contextKind).toBe("html-fallback");
    expect(diagnostic.markdown).toContain("## HTML fallback");
    expect(diagnostic.markdown).toContain("<main>fallback</main>");
  });

  it("uses file, line, and project to avoid duplicate-title collisions", () => {
    const first = diagnosticIdentity({ file: "tests/a.spec.ts", line: 1, project: "chromium", title: "same" });
    const second = diagnosticIdentity({ file: "tests/b.spec.ts", line: 1, project: "chromium", title: "same" });
    expect(first.id).not.toBe(second.id);
  });

  it("writes an exact digest and failure index", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pw-diagnostic-"));
    try {
      const diagnostic = buildFailureDiagnostic({
        runId: "playwright-write-run",
        rootDir: root,
        title: "writes a digest",
        file: "tests/example.spec.ts",
        line: 9,
        project: "chromium",
        status: "failed",
        duration: 20,
        logs: [],
        accessibilitySnapshot: '- main:\n  - button "Retry"',
      });
      const result = writeFailureDiagnostic(root, diagnostic);
      const index = JSON.parse(
        fs.readFileSync(path.join(root, "test-results/failures/playwright-write-run/index.json"), "utf8"),
      );
      expect(fs.existsSync(result.digestPath)).toBe(true);
      expect(index).toMatchObject({
        runId: "playwright-write-run",
        failures: [{ id: diagnostic.identity.id, runId: "playwright-write-run" }],
      });

      const second = buildFailureDiagnostic({
        runId: "playwright-second-run",
        title: "writes a digest",
        file: "tests/example.spec.ts",
        line: 9,
        project: "chromium",
        status: "failed",
        duration: 20,
        logs: [],
        accessibilitySnapshot: '- main:\n  - button "Retry"',
      });
      const secondResult = writeFailureDiagnostic(root, second);
      expect(second.identity.id).toBe(diagnostic.identity.id);
      expect(secondResult.digestPath).not.toBe(result.digestPath);
      expect(fs.existsSync(result.digestPath)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
