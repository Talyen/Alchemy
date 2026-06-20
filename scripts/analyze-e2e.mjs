import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("=========================================");
console.log("🚀 Starting E2E Test Suite Audit...");
console.log("=========================================");

// Ensure reports directory exists
const reportsDir = path.join(process.cwd(), "reports");
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Run Playwright E2E tests with JSON reporter outputting to reports/e2e-results.json
console.log("Running Playwright test suite. This might take a few moments...");
const extraArgs = process.argv.slice(2);
const result = spawnSync("npm", ["run", "test:e2e:timings", "--", ...extraArgs], {
  stdio: "inherit",
  shell: true,
});

const reportPath = path.join(reportsDir, "e2e-results.json");

if (!fs.existsSync(reportPath)) {
  console.error("❌ Error: playwright json report was not generated at:", reportPath);
  process.exit(result.status !== 0 ? result.status : 1);
}

console.log("\n📊 Processing test results and generating audit report...");

try {
  const rawData = fs.readFileSync(reportPath, "utf-8");
  const data = JSON.parse(rawData);

  const allSpecs = [];
  function traverseSuite(suite) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        allSpecs.push(spec);
      }
    }
    if (suite.suites) {
      for (const subSuite of suite.suites) {
        traverseSuite(subSuite);
      }
    }
  }

  if (data.suites) {
    for (const suite of data.suites) {
      traverseSuite(suite);
    }
  }

  let totalTests = 0;
  let passedTests = 0;
  let skippedTests = 0;
  const failedTests = [];
  const flakyTests = [];
  const allTests = [];

  for (const spec of allSpecs) {
    const title = spec.title;
    const file = spec.file;
    const line = spec.line;

    for (const test of spec.tests) {
      totalTests++;
      const duration = test.results.reduce((sum, r) => sum + r.duration, 0);
      const isSkipped = test.status === "skipped";
      const isFailed = test.status === "unexpected";
      const isFlaky = test.status === "flaky";

      // Find first error message if any
      let errorMessage = null;
      for (const res of test.results) {
        if (res.errors && res.errors.length > 0) {
          errorMessage = res.errors[0].message;
          break;
        }
      }

      const testInfo = {
        title,
        file,
        line,
        duration,
        status: test.status,
        expectedStatus: test.expectedStatus,
        errorMessage,
        retries: test.results.length - 1,
      };

      allTests.push(testInfo);

      if (isSkipped) {
        skippedTests++;
      } else if (isFailed) {
        failedTests.push(testInfo);
      } else if (isFlaky) {
        flakyTests.push(testInfo);
        passedTests++;
      } else {
        passedTests++;
      }
    }
  }

  // Sort tests by duration (slowest first)
  const slowestTests = [...allTests]
    .filter(t => t.status !== "skipped")
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
    `| **Total Duration** | ${((allTests.reduce((sum, t) => sum + t.duration, 0)) / 1000).toFixed(2)}s |`,
  ];

  // 1. Failures Section
  if (failedTests.length > 0) {
    mdReport.push(`\n## ❌ Failed Tests (${failedTests.length})`);
    for (const test of failedTests) {
      const cleanTitle = test.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      mdReport.push([
        `### 🛑 ${test.title}`,
        `- **File:** [${test.file}:${test.line}](file:///${path.resolve(test.file).replace(/\\/g, "/")})`,
        `- **Duration:** ${(test.duration / 1000).toFixed(2)}s`,
        `- **Failure Diagnostics:** Check [test-results/failures/${cleanTitle}.md](file:///${path.resolve("test-results/failures/" + cleanTitle + ".md").replace(/\\/g, "/")}) for DOM & console logs.`,
        `\n\`\`\`text\n${test.errorMessage || "No explicit error message captured by Playwright."}\n\`\`\``,
      ].join("\n"));
    }
  } else {
    mdReport.push(`\n## ❌ Failed Tests\n🎉 No test failures in this run!`);
  }

  // 2. Flaky Section
  if (flakyTests.length > 0) {
    mdReport.push(`\n## ⚠️ Flaky Tests (${flakyTests.length})`);
    mdReport.push(`*These tests failed initially but passed after a retry. They represent potential timing or animation issues.*`);
    for (const test of flakyTests) {
      mdReport.push([
        `### 🟨 ${test.title}`,
        `- **File:** [${test.file}:${test.line}](file:///${path.resolve(test.file).replace(/\\/g, "/")})`,
        `- **Total Duration (including retries):** ${(test.duration / 1000).toFixed(2)}s`,
        `- **Retries:** ${test.retries}`,
        `\n**First Run Error Message:**`,
        `\`\`\`text\n${test.errorMessage || "No explicit error message captured."}\n\`\`\``,
      ].join("\n"));
    }
  }

  // 3. Slowest Tests Section
  mdReport.push(`\n## ⏱️ Top 10 Slowest Tests`);
  mdReport.push(`| Test Case | File | Duration | Status |`, `| :--- | :--- | :--- | :--- |`);
  for (const test of slowestTests) {
    const fileLink = `[${path.basename(test.file)}:${test.line}](file:///${path.resolve(test.file).replace(/\\/g, "/")})`;
    const statusIcon = test.status === "passed" ? "🟢" : test.status === "failed" ? "🔴" : "🟨";
    mdReport.push(`| ${test.title} | ${fileLink} | ${(test.duration / 1000).toFixed(2)}s | ${statusIcon} ${test.status} |`);
  }

  // 4. Optimization Recommendations
  mdReport.push([
    `\n## 💡 Best Practice Recommendations`,
    `1. **Leverage Fast Battle Mode:** If the test is in a combat cycle, ensure it uses the \`fastBattle\` fixture from \`tests/fixtures/e2e.ts\` to disable time-consuming card and turn animations.`,
    `2. **Use State Injection:** Instead of playing through early stages of combat, utilize state injection hooks like \`injectMidCombatSave\` or seed the character storage states to jump directly to the target node.`,
    `3. **Eliminate Hard Wait Hooks:** Never use manual timeouts or \`page.waitForTimeout()\`. Instead, rely on Playwright's locator assertions (e.g. \`expect(locator).toBeVisible()\`) which leverage auto-retry capability.`,
    `4. **Trace Files:** Open the trace ZIPs in Playwright's trace viewer (\`npx playwright show-trace test-results/.../trace.zip\`) to step through actions, network calls, and console error timestamps.`,
  ].join("\n"));

  const auditReportPath = path.join(reportsDir, "e2e-audit-report.md");
  fs.writeFileSync(auditReportPath, mdReport.join("\n"), "utf-8");
  console.log(`\n🎉 Audit report generated successfully at:`);
  console.log(`👉 file:///${auditReportPath.replace(/\\/g, "/")}\n`);

} catch (err) {
  console.error("❌ Failed to process playwright JSON and generate audit report:", err);
}

// Exit with the code returned by Playwright to preserve CI pipelines
process.exit(result.status);
