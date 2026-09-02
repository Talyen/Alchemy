import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function runSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48);
}

export function normalizeRunId(value) {
  return runSlug(value);
}

export function createRunId(label = "run", options = {}) {
  const now = options.now ?? new Date();
  const stamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/u, "Z")
    .replaceAll(/[-:]/gu, "");
  const pid = options.pid ?? process.pid;
  const suffix = options.suffix ?? randomBytes(3).toString("hex");
  return runSlug(`${runSlug(label) || "run"}-${stamp}-${pid}-${runSlug(suffix) || "id"}`);
}

export function ensureRunId(label = "run", env = process.env) {
  const supplied = runSlug(env.ALCHEMY_RUN_ID);
  if (supplied) {
    env.ALCHEMY_RUN_ID = supplied;
    return supplied;
  }
  const githubRun = runSlug(env.GITHUB_RUN_ID);
  const githubAttempt = runSlug(env.GITHUB_RUN_ATTEMPT);
  const githubJob = runSlug(env.GITHUB_JOB);
  const variant = runSlug(env.ALCHEMY_RUN_VARIANT);
  const runId = githubRun
    ? ["gh", githubRun, githubAttempt || "1", githubJob || "job", variant].filter(Boolean).join("-")
    : createRunId(label);
  env.ALCHEMY_RUN_ID = runId;
  return runId;
}

function gitOutput(rootDir, args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout : "";
}

/**
 * Paths reported by `git status --short --untracked-files=all`. Rename entries
 * emit the new path as the entry and the original path as a following
 * NUL-delimited field; only the target path is kept. Returns null when git
 * itself fails so callers can distinguish "clean tree" from "could not ask".
 */
export function changedGitPaths(rootDir) {
  const result = spawnSync("git", ["status", "--short", "--untracked-files=all", "-z"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return null;
  const fields = (result.stdout ?? "").split("\0");
  const paths = [];
  for (let i = 0; i < fields.length; i += 1) {
    const entry = fields[i];
    if (!entry.trim()) continue;
    paths.push((entry.length >= 3 && entry[2] === " " ? entry.slice(3) : entry).trim());
    // Rename/copy entries carry the original path in the next NUL field — skip it.
    const status = entry.slice(0, 2);
    if (/^[RC]/.test(status) && i + 1 < fields.length) i += 1;
  }
  return paths;
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

function normalizeCounts(counts) {
  if (!counts || typeof counts !== "object") return null;
  const normalized = {};
  for (const key of ["passed", "failed", "skipped", "flaky"]) {
    const value = Number(counts[key]);
    if (Number.isInteger(value) && value >= 0) normalized[key] = value;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeCommandExposures(exposures) {
  if (!Array.isArray(exposures)) return [];
  return exposures.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const numeric = (key) => Math.max(0, Number(entry[key]) || 0);
    return [
      {
        key: String(entry.key ?? "command").slice(0, 120),
        label: String(entry.label ?? entry.key ?? "command").slice(0, 200),
        command: String(entry.command ?? "unknown").slice(0, 300),
        status: Number.isInteger(entry.status) ? entry.status : null,
        durationMs: numeric("durationMs"),
        rawBytes: numeric("rawBytes"),
        rawLines: numeric("rawLines"),
        exposedBytes: numeric("exposedBytes"),
        exposedLines: numeric("exposedLines"),
        omittedBytes: numeric("omittedBytes"),
        omittedPercent: Math.min(100, numeric("omittedPercent")),
        budgetBytes: entry.budgetBytes == null ? null : numeric("budgetBytes"),
        overBudget: entry.overBudget === true,
      },
    ];
  });
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.flatMap((step) => {
    if (!step || typeof step !== "object") return [];
    return [
      {
        label: String(step.label ?? "step").slice(0, 200),
        status: ["passed", "failed", "skipped"].includes(step.status) ? step.status : "failed",
        durationMs: Math.max(0, Number(step.durationMs) || 0),
        ...(step.reason ? { reason: String(step.reason).slice(0, 300) } : {}),
      },
    ];
  });
}

function renderRunMarkdown(payload) {
  const countText = payload.counts
    ? Object.entries(payload.counts)
        .map(([key, value]) => `${key} ${value}`)
        .join(", ")
    : "";
  return [
    "# Current run",
    "",
    `- Run: \`${payload.runId}\``,
    `- Status: **${payload.status}**`,
    `- Command: \`${payload.command}\``,
    `- Generated: ${payload.generatedAt}`,
    ...(payload.commit ? [`- Commit: \`${payload.commit}\``] : []),
    ...(countText ? [`- Counts: ${countText}`] : []),
    `- Dirty paths at generation: ${payload.dirtyPaths.length + payload.omittedDirtyPaths}`,
    ...payload.dirtyPaths.map((dirtyPath) => `  - \`${dirtyPath}\``),
    ...(payload.omittedDirtyPaths > 0 ? [`  - _…and ${payload.omittedDirtyPaths} more_`] : []),
    ...(payload.commandExposures.length > 0
      ? [
          `- Captured command output: ${payload.commandExposures.reduce((sum, entry) => sum + entry.rawBytes, 0).toLocaleString()} bytes; exposed ${payload.commandExposures.reduce((sum, entry) => sum + entry.exposedBytes, 0).toLocaleString()} bytes`,
        ]
      : []),
    ...(payload.sourceDigest ? [`- Source digest: \`${payload.sourceDigest}\``] : []),
    "",
    ...(payload.steps.length > 0
      ? [
          "## Steps",
          "",
          ...payload.steps.map(
            (step) =>
              `- **${step.status}** ${step.label} (${(step.durationMs / 1000).toFixed(1)}s)` +
              (step.reason ? ` — ${step.reason}` : ""),
          ),
          "",
        ]
      : []),
    "## Primary evidence",
    "",
    ...artifactLines(payload.artifacts, "primary"),
    "",
    "## Secondary drill-down",
    "",
    ...artifactLines(payload.artifacts, "secondary"),
    ...(payload.summary ? ["", payload.summary] : []),
    "",
  ].join("\n");
}

/** Write one compact, source-state-aware pointer to the latest report-producing command. */
export function writeCurrentRun({
  rootDir,
  runId = ensureRunId("run"),
  status,
  command,
  artifacts = [],
  summary = "",
  counts,
  commit,
  commandExposures = [],
  steps = [],
  sourceDigest,
} = {}) {
  if (!rootDir) throw new Error("writeCurrentRun requires rootDir");
  const reportsDir = path.join(rootDir, "reports");
  const normalizedRunId = runSlug(runId);
  if (!normalizedRunId) throw new Error("writeCurrentRun requires a valid runId");
  const runDir = path.join(reportsDir, "runs", normalizedRunId);
  fs.mkdirSync(runDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const state = sourceState(rootDir, commit);
  const normalizedArtifacts = artifacts.map((artifact) => normalizeArtifact(rootDir, artifact));
  const payload = {
    runId: normalizedRunId,
    generatedAt,
    ...state,
    status: status ?? "unknown",
    command: command ?? "unknown",
    artifacts: normalizedArtifacts,
    summary: summary.slice(0, 500),
    counts: normalizeCounts(counts),
    commandExposures: normalizeCommandExposures(commandExposures),
    steps: normalizeSteps(steps),
    sourceDigest: sourceDigest ? String(sourceDigest).slice(0, 120) : null,
  };
  const jsonPath = path.join(reportsDir, "current-run.json");
  const markdownPath = path.join(reportsDir, "current-run.md");
  const runJsonPath = path.join(runDir, "run.json");
  const runMarkdownPath = path.join(runDir, "run.md");
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const markdown = renderRunMarkdown(payload);
  fs.writeFileSync(runJsonPath, json, "utf8");
  fs.writeFileSync(runMarkdownPath, markdown, "utf8");
  fs.writeFileSync(jsonPath, json, "utf8");
  fs.writeFileSync(markdownPath, markdown, "utf8");
  return { jsonPath, markdownPath, runJsonPath, runMarkdownPath, runId: normalizedRunId };
}
