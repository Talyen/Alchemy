import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function currentCommit(rootDir) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function normalizeArtifact(rootDir, artifact) {
  return path.relative(rootDir, path.resolve(rootDir, artifact)).replaceAll(path.sep, "/");
}

/**
 * Write one compact pointer to the latest report-producing command.
 * @param {{ rootDir: string, status: string, command: string, artifacts?: string[], summary?: string, commit?: string|null }} options
 * @returns {{ jsonPath: string, markdownPath: string }}
 */
export function writeCurrentRun({ rootDir, status, command, artifacts = [], summary = "", commit } = {}) {
  if (!rootDir) throw new Error("writeCurrentRun requires rootDir");
  const reportsDir = path.join(rootDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const normalizedArtifacts = artifacts.map((artifact) => normalizeArtifact(rootDir, artifact));
  const payload = {
    generatedAt,
    commit: commit === undefined ? currentCommit(rootDir) : commit,
    status: status ?? "unknown",
    command: command ?? "unknown",
    artifacts: normalizedArtifacts,
    summary: summary.slice(0, 500),
  };
  const jsonPath = path.join(reportsDir, "current-run.json");
  const markdownPath = path.join(reportsDir, "current-run.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const lines = [
    "# Current run",
    "",
    `- Status: **${payload.status}**`,
    `- Command: \`${payload.command}\``,
    `- Generated: ${payload.generatedAt}`,
    ...(payload.commit ? [`- Commit: \`${payload.commit}\``] : []),
    "",
    "## Drill-down artifacts",
    "",
    ...(payload.artifacts.length > 0 ? payload.artifacts.map((artifact) => `- \`${artifact}\``) : ["- None"]),
    ...(payload.summary ? ["", payload.summary] : []),
    "",
  ];
  fs.writeFileSync(markdownPath, lines.join("\n"), "utf8");
  return { jsonPath, markdownPath };
}
