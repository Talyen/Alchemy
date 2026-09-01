#!/usr/bin/env node
/** Print the changed-path verification plan for a CI push range (informational, not a gate). */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRoutePlan } from "./lib/change-routes.mjs";
import { publishCiSummary } from "./lib/ci-summary.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { formatPlan, getStrictUnknownPaths } from "./verify-changed.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  let base = null;
  let head = "HEAD";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base") {
      base = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--head") {
      head = argv[index + 1] ?? "HEAD";
      index += 1;
    } else if (arg.startsWith("--base=")) base = arg.slice("--base=".length) || null;
    else if (arg.startsWith("--head=")) head = arg.slice("--head=".length) || "HEAD";
  }
  return { base, head };
}

function gitChangedPaths(base, head) {
  if (!base || /^0+$/u.test(base)) return null;
  const result = spawnSync("git", ["diff", "--name-only", `${base}...${head}`], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  return (result.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const { base, head } = parseArgs(process.argv.slice(2));
  const paths = gitChangedPaths(base, head);
  if (!paths || paths.length === 0) {
    const markdown = "## Changed-path plan\n\n_No push range to plan against._\n";
    publishCiSummary({
      rootDir: ROOT,
      markdown,
      status: "skipped",
      command: "verify:changed --plan",
      summary: "No push range for changed-path plan.",
    });
    return;
  }
  const plan = resolveRoutePlan(paths);
  const strictUnknown = getStrictUnknownPaths(plan);
  const body = formatPlan(plan);
  const markdown = `## Changed-path plan\n\n\`\`\`\n${body.trimEnd()}\n\`\`\`\n`;
  if (strictUnknown.length > 0) {
    const failSummary = `Strict unknown routes: ${strictUnknown.join(", ")}`;
    publishCiSummary({
      rootDir: ROOT,
      markdown: `${markdown}\n**Failed:** ${failSummary}\n`,
      status: "failed",
      command: "verify:changed --plan --strict-routes",
      summary: failSummary,
    });
    console.error(`Strict unknown executable paths: ${strictUnknown.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  publishCiSummary({
    rootDir: ROOT,
    markdown,
    status: "passed",
    command: "verify:changed --plan",
    summary: `Routes: ${plan.routes.map((route) => route.id).join(", ") || "(none)"}.`,
  });
}

if (isMainModule(import.meta.url)) main();
