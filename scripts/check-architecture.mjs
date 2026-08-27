#!/usr/bin/env node
/** Consolidated entry for architecture / routing / docs checks. */
import { spawnSync } from "node:child_process";

const SUBCOMMANDS = {
  routing: { command: "node", args: ["scripts/check-ci-routing.mjs"] },
  docs: { command: "node", args: ["scripts/check-docs.mjs"] },
  "docs-final": { command: "node", args: ["scripts/check-docs.mjs", "--final"] },
  "arch-smoke": { command: "node", args: ["scripts/lint-architecture-smoke.mjs"] },
  "test-owners": { command: "node", args: ["scripts/check-test-owners.mjs"] },
  all: { command: "npm", args: ["run", "lint:ci"] },
};

function main() {
  const sub = process.argv[2] ?? "all";
  const entry = SUBCOMMANDS[sub];
  if (!entry) {
    console.error(`Unknown subcommand: ${sub}`);
    console.error(`Available: ${Object.keys(SUBCOMMANDS).join(", ")}`);
    process.exitCode = 2;
    return;
  }
  const result = spawnSync(entry.command, entry.args, { stdio: "inherit", shell: false });
  process.exitCode = result.status ?? 1;
}

main();
