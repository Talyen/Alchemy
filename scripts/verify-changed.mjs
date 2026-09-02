#!/usr/bin/env node
/** Route the smallest complete verification set for the paths being changed. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commandExposure, sanitizeOutput, tailOutput, writeDiagnosticLog } from "./lib/compact-output.mjs";
import { E2E_NAMES, resolveRoutePlan, ROUTES } from "./lib/change-routes.mjs";
import { changedGitPaths, ensureRunId, writeCurrentRun } from "./lib/current-run.mjs";
import { globToRegExp } from "./lib/glob-pattern.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { runCommand } from "./lib/run-command.mjs";
import { unownedAddedSourceFiles } from "./check-test-owners.mjs";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function changedPathsFromGit() {
  const paths = changedGitPaths(ROOT);
  if (!paths) throw new Error("git status failed");
  return paths;
}

function parseArgs(argv) {
  const flags = new Set();
  const paths = [];
  let e2e;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--e2e") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--") && E2E_NAMES.has(next)) {
        e2e = next;
        index += 1;
      } else e2e = true;
    } else if (arg.startsWith("--e2e=")) {
      const selection = arg.slice("--e2e=".length);
      if (!E2E_NAMES.has(selection)) throw new Error(`Unknown E2E route: ${selection}`);
      e2e = selection;
    } else if (arg.startsWith("--")) flags.add(arg.slice(2));
    else paths.push(arg);
  }
  if (paths.length > 0 && flags.has("diff")) throw new Error("Choose explicit paths or --diff, not both.");
  if (paths.length === 0 && !flags.has("diff"))
    throw new Error("Provide paths or use --diff. Example: npm run verify:changed -- --diff --plan");
  return { e2e, flags, paths: paths.length > 0 ? paths : changedPathsFromGit() };
}

function testPathCount(command) {
  return command.args.filter((arg) => /^tests\//u.test(arg)).length;
}

function localAddedSourcePaths(paths) {
  const result = spawnSync("git", ["diff", "--diff-filter=A", "--name-only", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const addedFromGit =
    result.status === 0
      ? result.stdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      : [];
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const untrackedFiles =
    untracked.status === 0
      ? untracked.stdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      : [];
  const addedSet = new Set([...addedFromGit, ...untrackedFiles]);
  return paths.filter((p) => addedSet.has(p));
}

function localUnownedOwners(paths) {
  const added = localAddedSourcePaths(paths);
  return unownedAddedSourceFiles(added);
}

function isStrictExecutablePath(filePath) {
  if (filePath.endsWith(".md")) return false;
  if (filePath.startsWith("docs/")) return false;
  if (filePath.startsWith(".agents/") && filePath.endsWith(".md")) return false;
  if (/^(src|tests|scripts|\.github|desktop|public)\//u.test(filePath)) return true;
  if (
    /^(package\.json|vite\.config\.ts|knip\.|lefthook\.yml|eslint|tsconfig|dependency-cruiser|stryker\.config)/u.test(
      filePath,
    )
  )
    return true;
  if (/\.(ts|tsx|js|mjs|cjs|json|yml|yaml)$/u.test(filePath)) return true;
  return false;
}

export function getStrictUnknownPaths(plan) {
  const isKnown = (filePath) =>
    ROUTES.some((route) => {
      const matchesPattern = (pat) => globToRegExp(pat).test(filePath);
      const matched = route.patterns.some(matchesPattern);
      if (!matched) return false;
      const excluded = (route.exclude ?? []).some(matchesPattern);
      return !excluded;
    });
  return plan.paths.filter((p) => !isKnown(p) && isStrictExecutablePath(p));
}

export function formatPlan(plan, { verbosePlan = false } = {}) {
  const lines = [`Changed paths: ${plan.paths.length}`];
  for (const filePath of plan.paths.slice(0, 20)) lines.push(`  ${filePath}`);
  if (plan.paths.length > 20) lines.push(`  … ${plan.paths.length - 20} more paths`);
  lines.push(`Routes: ${plan.routes.map((route) => route.id).join(", ")}`);
  for (const route of plan.routes) {
    if (route.unknown)
      lines.push("Warning: route ownership is unknown; the static fallback may not exercise this behavior.");
  }
  const localUnowned = localUnownedOwners(plan.paths);
  if (localUnowned.length > 0) {
    lines.push(`Test-owner check: ${localUnowned.length} new source file(s) without mirrored owners`);
    for (const filePath of localUnowned) lines.push(`  - ${filePath} (needs tests/<path>.test.ts)`);
  }
  lines.push("Commands:");
  for (const command of plan.commands) {
    const pathCount = testPathCount(command);
    const suffix = pathCount > 0 ? ` (${pathCount} test path${pathCount === 1 ? "" : "s"})` : "";
    lines.push(`  ${command.key}: ${command.label}${suffix} — ${command.reason}`);
    if (verbosePlan) lines.push(`    ${command.command} ${command.args.join(" ")}`);
  }
  if (localUnowned.length > 0) {
    lines.push(
      "  check:test-owners:local: test owners for new source files — new src files must have mirrored Vitest owners",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function writeFailureDigest(directory, command, result, runId, index) {
  fs.mkdirSync(directory, { recursive: true });
  const stem = `${String(index + 1).padStart(2, "0")}-${command.key}`;
  const logPath = writeDiagnosticLog(directory, stem, result.output);
  const digestPath = path.join(directory, `${stem}.md`);
  const normalized = sanitizeOutput(result.output).trim();
  const excerpt = (
    normalized.length <= 4_000
      ? normalized
      : `${normalized.slice(0, 1_200)}\n[…${normalized.length - 4_000} chars omitted…]\n${normalized.slice(-2_800)}`
  ).replaceAll("```", "``\u200b`");
  fs.writeFileSync(
    digestPath,
    [
      `# Verification failure: ${command.label}`,
      "",
      `- Run: \`${runId}\``,
      `- Command key: \`${command.key}\``,
      `- Exit: \`${result.status ?? "unknown"}\``,
      `- Duration: \`${(result.elapsedMs / 1000).toFixed(1)}s\``,
      "",
      "## Bounded failure output",
      "",
      "```text",
      excerpt,
      "```",
      "",
    ].join("\n"),
    "utf8",
  );
  return { digestPath, logPath };
}

function runVerificationCommand(command, index, verbose, runId) {
  const result = runCommand(command.command, command.args, {
    cwd: ROOT,
    env: { ...process.env, ALCHEMY_RUN_ID: runId },
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"],
  });
  const { output } = result;
  const elapsed = (result.elapsedMs / 1000).toFixed(1);
  const verboseOutput = verbose && output ? output : "";
  if (verboseOutput) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  if (result.status === 0) {
    const exposure = commandExposure({
      key: command.key,
      label: command.label,
      command: `${command.command} ${command.args.join(" ")}`,
      result,
      exposedOutput: verboseOutput,
      budgetBytes: verbose ? null : undefined,
    });
    if (exposure.overBudget) {
      console.error(
        `✗ ${command.label} exposed ${exposure.exposedBytes.toLocaleString()} bytes; ` +
          `routine budget is ${exposure.budgetBytes?.toLocaleString()} bytes (run ${runId})`,
      );
    } else console.log(`✓ ${command.label} (${elapsed}s, run ${runId})`);
    return {
      passed: !exposure.overBudget,
      exposureFailure: exposure.overBudget,
      command,
      result,
      exposure,
    };
  }
  const reportsDir = path.join(ROOT, "reports", "runs", runId, "verify-changed");
  const { digestPath, logPath } = writeFailureDigest(reportsDir, command, result, runId, index);
  console.error(`✗ ${command.label} (${elapsed}s, exit ${result.status ?? "unknown"}, run ${runId})`);
  const failureTail = tailOutput(output);
  console.error(`  ${failureTail}`);
  console.error(`  Failure digest: ${path.relative(ROOT, digestPath)}`);
  console.error(`  Full output: ${path.relative(ROOT, logPath)}`);
  return {
    passed: false,
    command,
    result,
    digestPath,
    logPath,
    exposure: commandExposure({
      key: command.key,
      label: command.label,
      command: `${command.command} ${command.args.join(" ")}`,
      result,
      exposedOutput: verboseOutput ? `${verboseOutput}\n${failureTail}` : failureTail,
      budgetBytes: verbose ? null : undefined,
    }),
  };
}

export function main(argv = process.argv.slice(2)) {
  const runId = ensureRunId("verify");
  try {
    const { e2e, flags, paths } = parseArgs(argv);
    const plan = resolveRoutePlan(paths, { e2e, full: flags.has("full") });
    console.log(`Run: ${runId}`);
    process.stdout.write(formatPlan(plan, { verbosePlan: flags.has("verbose-plan") }));
    const strict = flags.has("strict-routes") || flags.has("strict");
    if (strict) {
      const strictUnknown = getStrictUnknownPaths(plan);
      if (strictUnknown.length > 0) {
        console.error(`Strict route check failed: ${strictUnknown.length} executable path(s) without ownership:`);
        for (const p of strictUnknown) console.error(`- ${p}`);
        console.error(`Add owning route in scripts/lib/change-routes.mjs or move file to owned area.`);
        if (flags.has("plan")) return 1;
        const fakeResult = {
          status: 1,
          elapsedMs: 0,
          output: `Strict unknown routes:\n${strictUnknown.join("\n")}`,
        };
        const fakeCommand = {
          key: "strict-routes",
          label: "strict route ownership",
          command: "npm run verify:changed",
          args: ["--", "--strict-routes"],
          reason: "executable paths must have route ownership",
        };
        const reportsDir = path.join(ROOT, "reports", "runs", runId, "verify-changed");
        const { digestPath, logPath } = writeFailureDigest(reportsDir, fakeCommand, fakeResult, runId, 0);
        console.error(`  Failure digest: ${path.relative(ROOT, digestPath)}`);
        console.error(`  Full output: ${path.relative(ROOT, logPath)}`);
        writeCurrentRun({
          rootDir: ROOT,
          runId,
          status: "failed",
          command: "npm run verify:changed",
          artifacts: [
            { path: digestPath, role: "primary" },
            { path: logPath, role: "secondary" },
          ],
          counts: { passed: 0, failed: 1 },
          commandExposures: [],
          summary: "strict route ownership failed; add owning route.",
        });
        return 1;
      }
    }
    if (flags.has("plan")) {
      const localUnowned = localUnownedOwners(plan.paths);
      return localUnowned.length > 0 ? 1 : 0;
    }
    const localUnowned = localUnownedOwners(plan.paths);
    if (localUnowned.length > 0) {
      console.error(
        "New source files have no mirrored test owner (tests/<path>.test.ts; src/lib requires that basename match, other source may use tests/<dir>/*.test.ts):",
      );
      for (const filePath of localUnowned) console.error(`- ${filePath}`);
      const fakeResult = {
        status: 1,
        elapsedMs: 0,
        output: `Unowned new source files:\n${localUnowned.join("\n")}`,
      };
      const fakeCommand = {
        key: "check:test-owners:local",
        label: "test owners for new source files",
        command: "npm run check:test-owners",
        args: ["--", "--base", "HEAD"],
        reason: "new src files must have mirrored Vitest owners",
      };
      const reportsDir = path.join(ROOT, "reports", "runs", runId, "verify-changed");
      const { digestPath, logPath } = writeFailureDigest(
        reportsDir,
        fakeCommand,
        fakeResult,
        runId,
        plan.commands.length,
      );
      console.error(`  Failure digest: ${path.relative(ROOT, digestPath)}`);
      console.error(`  Full output: ${path.relative(ROOT, logPath)}`);
      writeCurrentRun({
        rootDir: ROOT,
        runId,
        status: "failed",
        command: "npm run verify:changed",
        artifacts: [
          { path: digestPath, role: "primary" },
          { path: logPath, role: "secondary" },
        ],
        counts: { passed: 0, failed: 1 },
        commandExposures: [],
        summary: "test owners for new source files failed; create mirrored owners.",
      });
      return 1;
    }
    const outcomes = [];
    for (const [index, command] of plan.commands.entries()) {
      const outcome = runVerificationCommand(command, index, flags.has("verbose"), runId);
      outcomes.push(outcome);
      if (!outcome.passed && !flags.has("keep-going")) break;
    }
    const failed = outcomes.filter((outcome) => !outcome.passed);
    const artifacts = failed.flatMap((outcome) =>
      outcome.digestPath && outcome.logPath
        ? [
            { path: outcome.digestPath, role: "primary" },
            { path: outcome.logPath, role: "secondary" },
          ]
        : [],
    );
    const exposureFailures = failed.filter((outcome) => outcome.exposureFailure);
    writeCurrentRun({
      rootDir: ROOT,
      runId,
      status: failed.length > 0 ? "failed" : "passed",
      command: "npm run verify:changed",
      artifacts,
      counts: { passed: outcomes.length - failed.length, failed: failed.length },
      commandExposures: outcomes.map((outcome) => outcome.exposure),
      summary:
        failed.length > 0
          ? exposureFailures.length > 0
            ? `${exposureFailures[0].command.label} exceeded the routine command-output exposure budget.`
            : `${failed[0].command.label} failed; inspect its bounded digest first.`
          : `${outcomes.length}/${outcomes.length} verification steps passed.`,
    });
    return failed.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (isMainModule(import.meta.url)) {
  const code = main();
  if (code !== 0) process.exitCode = code;
}
