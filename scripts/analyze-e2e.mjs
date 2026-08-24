import fs from "node:fs";
import path from "node:path";
import { ensureRunId, writeCurrentRun } from "./lib/current-run.mjs";
import { tailOutput, writeDiagnosticLog } from "./lib/compact-output.mjs";
import { diagnosticIdentity, failureDigestRelativePath, writeFailureIndex } from "./lib/playwright-diagnostics.mjs";
import { runCommand } from "./lib/run-command.mjs";
import {
  collectPlaywrightTests,
  formatPlaywrightSummaryMarkdown,
  summarizePlaywrightReport,
} from "./lib/playwright-summary.mjs";

const runId = ensureRunId("e2e-audit");
console.log(`Run: ${runId}`);

console.log("=========================================");
console.log("🚀 Starting E2E Test Suite Audit...");
console.log("=========================================");

// Ensure reports directory exists
const reportsDir = path.join(process.cwd(), "reports");
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Markdown links inside reports/e2e-audit-report.md must be relative to that file.
function linkFromReport(targetPath) {
  return path.relative(reportsDir, path.resolve(targetPath)).replaceAll("\\", "/");
}

// Run Playwright E2E tests with JSON reporter outputting to reports/e2e-results.json
const verbose = process.argv.includes("--verbose");
console.log("Running Playwright test suite; a compact summary will be shown when it finishes...");
const extraArgs = process.argv.slice(2).filter((arg) => arg !== "--verbose");
const result = runCommand("npm", ["run", "test:e2e:timings", "--", ...extraArgs], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
});
const commandOutput = result.output;
if (verbose && commandOutput) process.stdout.write(commandOutput.endsWith("\n") ? commandOutput : `${commandOutput}\n`);
if (result.status !== 0) {
  const logPath = writeDiagnosticLog(reportsDir, "e2e-audit-command", commandOutput);
  console.error(`Playwright exited with ${result.status ?? "unknown"}.`);
  console.error(tailOutput(commandOutput));
  console.error(`Full command output: ${path.relative(process.cwd(), logPath)}`);
  if (fs.existsSync(path.join(reportsDir, "e2e-results.json"))) {
    console.error(
      formatPlaywrightSummaryMarkdown(
        summarizePlaywrightReport(JSON.parse(fs.readFileSync(path.join(reportsDir, "e2e-results.json"), "utf8")), {
          maxFailures: 5,
        }),
      ),
    );
  }
}

const reportPath = path.join(reportsDir, "e2e-results.json");

if (!fs.existsSync(reportPath)) {
  console.error("❌ Error: playwright json report was not generated at:", reportPath);
  writeCurrentRun({
    rootDir: process.cwd(),
    status: "failed",
    command: "npm run test:e2e:audit",
    artifacts: ["reports/e2e-results.json"],
    summary: "Playwright JSON report was not generated.",
  });
  process.exit(typeof result.status === "number" && result.status !== 0 ? result.status : 1);
}

console.log("\n📊 Processing test results and generating audit report...");

try {
  const rawData = fs.readFileSync(reportPath, "utf-8");
  const data = JSON.parse(rawData);

  const { allTests, totalTests, passedTests, skippedTests, failedTests, flakyTests } = collectPlaywrightTests(data);

  // Sort tests by duration (slowest first)
  const slowestTests = [...allTests]
    .filter((t) => t.status !== "skipped")
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  // Compile Markdown report
  const timestamp = new Date().toLocaleString();
  const mdReport = [
    `# E2E Test Audit Report`,
    `Generated on: **${timestamp}**`,
    `\n## Run Summary`,
    `| Metric | Count |`,
    `| :--- | :--- |`,
    `| **Total Tests Run** | ${totalTests} |`,
    `| **Passed** | ${passedTests} |`,
    `| **Failed** | ${failedTests.length} |`,
    `| **Flaky (passed on retry)** | ${flakyTests.length} |`,
    `| **Skipped** | ${skippedTests} |`,
    `| **Total Duration** | ${(allTests.reduce((sum, t) => sum + t.duration, 0) / 1000).toFixed(2)}s |`,
  ];

  // 1. Failures Section
  if (failedTests.length > 0) {
    mdReport.push(`\n## ❌ Failed Tests (${failedTests.length})`);
    for (const test of failedTests.slice(0, 5)) {
      const identity = diagnosticIdentity({
        rootDir: process.cwd(),
        title: test.title,
        file: test.file,
        line: test.line,
        project: test.project,
      });
      const digestPath = failureDigestRelativePath(runId, identity.id);
      const diagnosticLine = fs.existsSync(path.resolve(digestPath))
        ? `- **Failure Diagnostics:** [${digestPath}](${linkFromReport(digestPath)})`
        : "- **Failure Diagnostics:** No bounded digest was produced for this test; use the error below.";
      mdReport.push(
        [
          `### 🛑 ${test.title}`,
          `- **File:** [${test.file}:${test.line}](${linkFromReport(test.file)}#L${test.line})`,
          `- **Duration:** ${(test.duration / 1000).toFixed(2)}s`,
          diagnosticLine,
          `\n\`\`\`text\n${test.errorMessage || "No explicit error message captured by Playwright."}\n\`\`\``,
        ].join("\n"),
      );
    }
    if (failedTests.length > 5)
      mdReport.push(`\n_…and ${failedTests.length - 5} more failures are in the JSON report._`);
  } else {
    mdReport.push(`\n## ❌ Failed Tests\n🎉 No test failures in this run!`);
  }

  // 2. Flaky Section
  if (flakyTests.length > 0) {
    mdReport.push(`\n## ⚠️ Flaky Tests (${flakyTests.length})`);
    mdReport.push(
      `*These tests failed initially but passed after a retry. They represent potential timing or animation issues.*`,
    );
    for (const test of flakyTests.slice(0, 5)) {
      mdReport.push(
        [
          `### 🟨 ${test.title}`,
          `- **File:** [${test.file}:${test.line}](${linkFromReport(test.file)}#L${test.line})`,
          `- **Total Duration (including retries):** ${(test.duration / 1000).toFixed(2)}s`,
          `- **Retries:** ${test.retries}`,
          `\n**First Run Error Message:**`,
          `\`\`\`text\n${test.errorMessage || "No explicit error message captured."}\n\`\`\``,
        ].join("\n"),
      );
    }
    if (flakyTests.length > 5)
      mdReport.push(`\n_…and ${flakyTests.length - 5} more flaky tests are in the JSON report._`);
  }

  // 3. Slowest Tests Section
  mdReport.push(`\n## ⏱️ Top 10 Slowest Tests`);
  mdReport.push(`| Test Case | File | Duration | Status |`, `| :--- | :--- | :--- | :--- |`);
  for (const test of slowestTests) {
    const fileLink = `[${path.basename(test.file)}:${test.line}](${linkFromReport(test.file)}#L${test.line})`;
    const statusIcon = test.status === "passed" ? "🟢" : test.status === "failed" ? "🔴" : "🟨";
    mdReport.push(
      `| ${test.title} | ${fileLink} | ${(test.duration / 1000).toFixed(2)}s | ${statusIcon} ${test.status} |`,
    );
  }

  mdReport.push(`\nE2E conventions and next-step guidance: [tests/e2e/README.md](../tests/e2e/README.md).`);

  const auditReportPath = path.join(reportsDir, "e2e-audit-report.md");
  fs.writeFileSync(auditReportPath, mdReport.join("\n"), "utf-8");
  console.log(`\n🎉 Audit report generated successfully at:`);
  console.log(`👉 ${path.relative(process.cwd(), auditReportPath)}\n`);
} catch (err) {
  console.error("❌ Failed to process playwright JSON and generate audit report:", err);
  // A green run with an unreadable/corrupt report must not exit 0 silently.
  process.exitCode = 1;
}

const failureIndex = writeFailureIndex(process.cwd());
writeCurrentRun({
  rootDir: process.cwd(),
  status: result.status === 0 ? "passed" : "failed",
  command: "npm run test:e2e:audit",
  artifacts: [
    { path: "reports/e2e-audit-report.md", role: "primary" },
    ...(failureIndex.failures.length > 0
      ? [
          { path: path.relative(process.cwd(), failureIndex.indexPath), role: "primary" },
          ...failureIndex.failures.slice(0, 5).map((failure) => ({ path: failure.digestPath, role: "primary" })),
        ]
      : []),
    { path: "reports/e2e-results.json", role: "secondary" },
    { path: "playwright-report", role: "secondary" },
    { path: "test-results", role: "secondary" },
  ],
  summary: result.status === 0 ? "E2E audit completed." : "E2E audit failed; inspect the first failure digest.",
});

// Exit with the code returned by Playwright to preserve CI pipelines
process.exit(result.status ?? 1);
