#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";
import { runTaskCommand } from "./lib/run-command.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SELECTORS = new Set(["--all", "--types", "--amplification", "--content"]);
const HELP_FLAGS = new Set(["--help", "-h"]);
const FORWARDABLE_FLAGS = new Set(["--verbose", "--json", "--check"]);
function isAllowedForwarded(arg) {
  return FORWARDABLE_FLAGS.has(arg);
}

function printHelp() {
  console.log(`Usage: node scripts/audit.mjs [selector] [options]
  --all (default)    Periodic measurable sweep (knip, depcruise, complexity, type-escapes, amplification, content)
                         NOTE: --all is the periodic sweep, not literally every audit.
                         Type-escape and amplification probes are advisory trends (always exit 0).
                         Accepts --verbose to stream child output.
  --types              Run type-escape audit only
  --amplification      Run change-amplification audit only
  --content            Run content audit only
  --help               Show this help`);
}

export function parseAuditArgs(argv) {
  const selected = [];
  const forwardedArgs = [];
  let inPassthrough = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (inPassthrough) {
      forwardedArgs.push(arg);
      continue;
    }
    if (arg === "--") {
      inPassthrough = true;
      continue;
    }
    if (HELP_FLAGS.has(arg)) {
      continue;
    }
    if (SELECTORS.has(arg)) {
      selected.push(arg);
      continue;
    }
    const prev = i > 0 ? argv[i - 1] : "";
    if (isAllowedForwarded(arg, prev)) {
      forwardedArgs.push(arg);
      continue;
    }
    throw new Error(`Unknown option or argument: ${arg}`);
  }

  const hasTypes = selected.includes("--types");
  const hasAmplification = selected.includes("--amplification");
  const hasContent = selected.includes("--content");
  const hasAll = selected.includes("--all");
  const specificCount = [hasTypes, hasAmplification, hasContent].filter(Boolean).length;
  if (hasAll && specificCount > 0)
    throw new Error("Conflicting options: --all cannot be combined with --types/--amplification/--content");
  if (specificCount > 1) throw new Error("Conflicting options: choose only one of --types/--amplification/--content");
  return { hasTypes, hasAmplification, hasContent, hasAll, forwardedArgs };
}

export function resolveAuditScript(parsed) {
  if (parsed.hasTypes) return "scripts/audit-type-escapes.mjs";
  if (parsed.hasAmplification) return "scripts/audit-change-amplification.mjs";
  if (parsed.hasContent) return "scripts/content-audit.mjs";
  return "scripts/audit-all.mjs";
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
  const script = resolveAuditScript(parsed);
  const childArgs = [script, ...parsed.forwardedArgs];
  const result = await runTaskCommand(process.execPath, childArgs, {
    cwd: ROOT,
    label: `audit (${script.replace(/^scripts\//u, "")})`,
    live: parsed.forwardedArgs.includes("--verbose"),
  });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
