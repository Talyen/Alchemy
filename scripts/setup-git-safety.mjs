#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), "..");
const shimDir = path.join(root, "scripts/bin");

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/setup-git-safety.mjs [--repo]
  --repo    Install repository-scoped shim via .envrc (direnv) only
  --help    Show this help

This installer is repository-scoped by default. It only edits <repo>/.envrc.
It does NOT edit shell profiles (~/.zshrc etc.) or install a global git wrapper.
For manual use: export PATH="${shimDir}:$PATH"`);
  process.exit(0);
}

const repoOnly = args.includes("--repo") || args.length === 0;
if (!repoOnly) {
  console.error("Unknown option. Only --repo is supported (repository-scoped install).");
  process.exit(2);
}

const envrc = path.join(root, ".envrc");
let envrcContent = "";
try {
  envrcContent = fs.readFileSync(envrc, "utf8");
} catch {}
if (!envrcContent.includes(shimDir)) {
  const addition = `export PATH="${shimDir}:$PATH"\n`;
  fs.appendFileSync(envrc, envrcContent.endsWith("\n") || envrcContent === "" ? addition : `\n${addition}`);
  console.log(`added shim to ${envrc} (direnv)`);
  try {
    const { spawnSync } = await import("node:child_process");
    spawnSync("direnv", ["allow", root], { stdio: "ignore" });
  } catch {}
} else {
  console.log(`ok: ${envrc} already contains shim`);
}

console.log(`\nShim available at ${shimDir}/git`);
console.log(`Activate: export PATH="${shimDir}:$PATH"  (or direnv allow)`);
console.log("Note: global shell profiles and ~/.local/bin are not modified. Use --repo (default).");
