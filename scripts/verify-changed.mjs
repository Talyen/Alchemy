#!/usr/bin/env node
/** Route the smallest complete verification set for the paths being changed. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { firstOutputLine, tailOutput, writeDiagnosticLog } from "./lib/compact-output.mjs";
import { E2E_NAMES, resolveRoutePlan, resolveRoutes } from "./lib/change-routes.mjs";
import { changedGitPaths, writeCurrentRun } from "./lib/current-run.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { runCommand } from "./lib/run-command.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORTS_DIR = path.join(ROOT, "reports", "verify-changed");

export { resolveRoutes };

export function resolvePlan(paths, options = {}) {
  return resolveRoutePlan(paths, options);
}

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

export function formatPlan(plan, { verbosePlan = false } = {}) {
  const lines = [`Changed paths: ${plan.paths.length}`];
  for (const filePath of plan.paths.slice(0, 20)) lines.push(`  ${filePath}`);
  if (plan.paths.length > 20) lines.push(`  … ${plan.paths.length - 20} more paths`);
  lines.push(`Routes: ${plan.routes.map((route) => route.id).join(", ")}`);
  for (const route of plan.routes) {
    if (route.unknown)
      lines.push("Warning: route ownership is unknown; the static fallback may not exercise this behavior.");
  }
  lines.push("Commands:");
  for (const command of plan.commands) {
    const pathCount = testPathCount(command);
    const suffix = pathCount > 0 ? ` (${pathCount} test path${pathCount === 1 ? "" : "s"})` : "";
    lines.push(`  ${command.key}: ${command.label}${suffix} — ${command.reason}`);
    if (verbosePlan) lines.push(`    ${command.command} ${command.args.join(" ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function runVerificationCommand(command, index, verbose) {
  const result = runCommand(command.command, command.args, {
    cwd: ROOT,
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"],
  });
  const { output } = result;
  const elapsed = (result.elapsedMs / 1000).toFixed(1);
  if (verbose && output) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  if (result.status === 0) {
    console.log(`✓ ${command.label} (${elapsed}s)`);
    return true;
  }
  const logPath = writeDiagnosticLog(REPORTS_DIR, `${String(index + 1).padStart(2, "0")}-${command.key}`, output);
  const first = firstOutputLine(output);
  const tail = tailOutput(output);
  writeCurrentRun({
    rootDir: ROOT,
    status: "failed",
    command: `npm run verify:changed (${command.key})`,
    artifacts: [{ path: logPath, role: "primary" }],
    summary: first,
  });
  console.error(`✗ ${command.label} (${elapsed}s, exit ${result.status ?? "unknown"})`);
  console.error(`  ${first}`);
  if (tail !== first) console.error(`  ${tail}`);
  console.error(`  Full output: ${path.relative(ROOT, logPath)}`);
  return false;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const { e2e, flags, paths } = parseArgs(argv);
    const plan = resolvePlan(paths, { e2e, full: flags.has("full") });
    process.stdout.write(formatPlan(plan, { verbosePlan: flags.has("verbose-plan") }));
    if (flags.has("plan")) return 0;
    let failed = 0;
    for (const [index, command] of plan.commands.entries()) {
      if (!runVerificationCommand(command, index, flags.has("verbose"))) failed += 1;
      if (failed > 0 && !flags.has("keep-going")) break;
    }
    return failed === 0 ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (isMainModule(import.meta.url)) {
  const code = main();
  if (code !== 0) process.exitCode = code;
}
