#!/usr/bin/env node
// Run Prettier with the shared globs, or on an explicit file list (lefthook staged files).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { PRETTIER_GLOBS, filterPrettierPaths } from "./prettier-paths.mjs";

const require = createRequire(import.meta.url);
const prettierCli = require.resolve("prettier/bin/prettier.cjs");

const mode = process.argv[2];
if (mode !== "--check" && mode !== "--write") {
  console.error("Usage: node scripts/run-prettier.mjs --check|--write [files...]");
  process.exit(2);
}

const explicitFiles = process.argv.slice(3);
const targets = explicitFiles.length > 0 ? filterPrettierPaths(explicitFiles) : [...PRETTIER_GLOBS];

if (targets.length === 0) {
  process.exit(0);
}

const result = spawnSync(process.execPath, [prettierCli, mode, ...targets], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
