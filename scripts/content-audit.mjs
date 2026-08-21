import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { writeCurrentRun } from "./lib/current-run.mjs";

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

const server = await createServer({
  configFile: path.join(rootDir, "vite.config.ts"),
  root: rootDir,
  server: { middlewareMode: true },
});

try {
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
    for (const issue of result.errors) {
      console.error(`[${issue.area}] ${issue.id}: ${issue.message}`);
    }
    process.exitCode = 1;
  }
} finally {
  await server.close();
}
