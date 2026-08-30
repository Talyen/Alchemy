#!/usr/bin/env node
import { isMainModule } from "./lib/is-main-module.mjs";
import { runCommand } from "./lib/run-command.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function printHelp() {
  console.log(`Usage: node scripts/audit.mjs [command]
  --all (default)      Run all measurable audits
  --types              Run type-escape audit only
  --amplification      Run change-amplification audit only
  --content            Run content audit only
  --hotspots           Run context hotspots
  --help               Show this help`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  const hasTypes = args.includes("--types");
  const hasAmplification = args.includes("--amplification");
  const hasContent = args.includes("--content");
  const hasHotspots = args.includes("--hotspots");
  const hasAll = args.includes("--all") || args.length === 0;

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
  if (hasAll) {
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
