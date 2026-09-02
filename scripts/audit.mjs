#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";
import { runCommand } from "./lib/run-command.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ALLOWED = new Set(["--all", "--sweep", "--types", "--amplification", "--content", "--hotspots", "--help", "-h"]);

function printHelp() {
  console.log(`Usage: node scripts/audit.mjs [command]
  --all/--sweep (default) Periodic measurable sweep (knip, depcruise, complexity, type-escapes, amplification, content)
                        NOTE: --all is the periodic sweep, not literally every audit — use --hotspots separately
  --types              Run type-escape audit only
  --amplification      Run change-amplification audit only
  --content            Run content audit only
  --hotspots           Run context hotspots (route preread budgets + command exposure)
  --help               Show this help`);
}

export function parseAuditArgs(argv) {
  const unknown = argv.filter((arg) => !ALLOWED.has(arg));
  if (unknown.length > 0) throw new Error(`Unknown option or argument: ${unknown.join(", ")}`);
  const hasTypes = argv.includes("--types");
  const hasAmplification = argv.includes("--amplification");
  const hasContent = argv.includes("--content");
  const hasHotspots = argv.includes("--hotspots");
  const hasAll = argv.includes("--all") || argv.includes("--sweep");
  const specificCount = [hasTypes, hasAmplification, hasContent, hasHotspots].filter(Boolean).length;
  if (hasAll && specificCount > 0)
    throw new Error(
      "Conflicting options: --all/--sweep cannot be combined with --types/--amplification/--content/--hotspots",
    );
  if (specificCount > 1)
    throw new Error("Conflicting options: choose only one of --types/--amplification/--content/--hotspots");
  return { hasTypes, hasAmplification, hasContent, hasHotspots, hasAll };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  let parsed;
  try {
    parsed = parseAuditArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
    return;
  }
  const { hasTypes, hasAmplification, hasContent, hasHotspots, hasAll } = parsed;
  const hasSpecific = hasTypes || hasAmplification || hasContent || hasHotspots;
  const runAll = hasAll || (!hasSpecific && args.length === 0);

  if (hasTypes) {
    const r = runCommand("node", ["scripts/audit-type-escapes.mjs"], { cwd: ROOT });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
    return;
  }
  if (hasAmplification) {
    const r = runCommand("node", ["scripts/audit-change-amplification.mjs"], { cwd: ROOT });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
    return;
  }
  if (hasContent) {
    const r = runCommand("node", ["scripts/content-audit.mjs"], { cwd: ROOT });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
    return;
  }
  if (hasHotspots) {
    const r = runCommand("node", ["scripts/context-hotspots.mjs"], { cwd: ROOT });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
    return;
  }
  if (runAll) {
    const r = runCommand("node", ["scripts/audit-all.mjs"], { cwd: ROOT });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
