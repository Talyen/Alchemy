import { tailOutput } from "./lib/compact-output.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCurrentRun } from "./lib/current-run.mjs";
import { defineScript } from "./lib/script-run.mjs";
import { withReportServer } from "./lib/vite-report-server.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = path.join(rootDir, "reports");
const jsonPath = path.join(reportsDir, "content-audit-report.json");
const markdownPath = path.join(reportsDir, "content-audit-report.md");

function renderMarkdown(result) {
  const lines = [
    "# Content Audit Report",
    "",
    `Errors: ${result.errors.length}`,
    `Warnings: ${result.warnings.length}`,
    "",
  ];

  for (const severity of ["error", "warning"]) {
    const issues = result.issues.filter((issue) => issue.severity === severity);
    lines.push(`## ${severity === "error" ? "Errors" : "Warnings"}`, "");
    if (issues.length === 0) {
      lines.push("None.", "");
      continue;
    }
    for (const issue of issues) {
      lines.push(`- [${issue.area}] ${issue.id}: ${issue.message}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function formatContentAuditErrors(errors) {
  const groups = new Map();
  for (const issue of errors) {
    const group = groups.get(issue.area) ?? { count: 0, example: issue };
    group.count += 1;
    groups.set(issue.area, group);
  }
  const diagnostics = [...groups].map(
    ([area, { count, example }]) => `[${area}] ${count} error(s); example ${example.id}: ${example.message}`,
  );
  return tailOutput(diagnostics.join("\n"), 2_800);
}

// Content validation is pure data/rules plus the `@` alias, so it shares the
// minimal middleware-mode SSR server in lib/vite-report-server.mjs instead of
// the full app config (tailwind/react/sentry/visualizer).
export async function runContentAudit() {
  return withReportServer(async (server) => {
    const mod = await server.ssrLoadModule("/src/lib/content-validation/index.ts");
    const result = mod.runContentValidation();
    await mkdir(reportsDir, { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    await writeFile(markdownPath, renderMarkdown(result));

    writeCurrentRun({
      rootDir,
      status: result.errors.length > 0 ? "failed" : "passed",
      command: "npm run content:audit",
      artifacts: [
        { path: "reports/content-audit-report.md", role: "primary" },
        { path: "reports/content-audit-report.json", role: "secondary" },
      ],
      summary: `Content audit: ${result.errors.length} error(s), ${result.warnings.length} warning(s).`,
    });

    console.log(`Content audit: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
    console.log(`Wrote ${path.relative(rootDir, markdownPath)} and ${path.relative(rootDir, jsonPath)}`);

    if (result.errors.length > 0) {
      console.error(formatContentAuditErrors(result.errors));
      throw new Error(`Content audit failed with ${result.errors.length} error(s).`);
    }
  });
}

defineScript(import.meta.url, () => runContentAudit());
