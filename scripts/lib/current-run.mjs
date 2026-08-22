import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function gitOutput(rootDir, args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout : "";
}

/**
 * Paths reported by `git status --short --untracked-files=all` (rename entries
 * collapse to the target path). Returns null when git itself fails so callers
 * can distinguish "clean tree" from "could not ask".
 */
export function changedGitPaths(rootDir) {
  const result = spawnSync("git", ["status", "--short", "--untracked-files=all", "-z"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return null;
  return (result.stdout ?? "")
    .split("\0")
    .filter((entry) => entry.trim())
    .map((entry) => (entry.length >= 3 && entry[2] === " " ? entry.slice(3) : entry).trim());
}

function sourceState(rootDir, commit) {
  const rawPaths = changedGitPaths(rootDir) ?? [];
  return {
    commit: commit === undefined ? gitOutput(rootDir, ["rev-parse", "HEAD"]).trim() || null : commit,
    dirtyPaths: rawPaths.slice(0, 20),
    omittedDirtyPaths: Math.max(0, rawPaths.length - 20),
  };
}

function normalizeArtifact(rootDir, artifact) {
  const value = typeof artifact === "string" ? { path: artifact, role: "primary" } : artifact;
  const relativePath = path.relative(rootDir, path.resolve(rootDir, value.path)).replaceAll(path.sep, "/");
  return {
    path: relativePath,
    role: value.role === "secondary" ? "secondary" : "primary",
    existsAtWrite: fs.existsSync(path.resolve(rootDir, value.path)),
  };
}

function artifactLines(artifacts, role) {
  const selected = artifacts.filter((artifact) => artifact.role === role);
  return selected.length > 0
    ? selected.map(
        (artifact) => `- \`${artifact.path}\`${artifact.existsAtWrite ? "" : " _(missing when pointer was written)_"}`,
      )
    : ["- None"];
}

/** Write one compact, source-state-aware pointer to the latest report-producing command. */
export function writeCurrentRun({ rootDir, status, command, artifacts = [], summary = "", commit } = {}) {
  if (!rootDir) throw new Error("writeCurrentRun requires rootDir");
  const reportsDir = path.join(rootDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const state = sourceState(rootDir, commit);
  const normalizedArtifacts = artifacts.map((artifact) => normalizeArtifact(rootDir, artifact));
  const payload = {
    generatedAt,
    ...state,
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
    `- Dirty paths at generation: ${payload.dirtyPaths.length + payload.omittedDirtyPaths}`,
    ...payload.dirtyPaths.map((dirtyPath) => `  - \`${dirtyPath}\``),
    ...(payload.omittedDirtyPaths > 0 ? [`  - _…and ${payload.omittedDirtyPaths} more_`] : []),
    "",
    "## Primary evidence",
    "",
    ...artifactLines(payload.artifacts, "primary"),
    "",
    "## Secondary drill-down",
    "",
    ...artifactLines(payload.artifacts, "secondary"),
    ...(payload.summary ? ["", payload.summary] : []),
    "",
  ];
  fs.writeFileSync(markdownPath, lines.join("\n"), "utf8");
  return { jsonPath, markdownPath };
}
