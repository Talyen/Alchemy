#!/usr/bin/env node
// Run Prettier with the shared globs, or on an explicit file list (lefthook staged files).
import { createRequire } from "node:module";
import { PRETTIER_GLOBS, filterPrettierPaths } from "./prettier-paths.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { runStreamCommand } from "./lib/run-command.mjs";
import { UsageError } from "./lib/script-run.mjs";

const require = createRequire(import.meta.url);
const prettierCli = require.resolve("prettier/bin/prettier.cjs");

const USAGE = "Usage: node scripts/run-prettier.mjs --check|--write [files...]";

export function resolvePrettierTargets(argv = process.argv.slice(2)) {
  const { flags, rest } = parseKnownFlags(argv, { check: {}, write: {} }, { usage: USAGE });
  const hasCheck = flags.has("check");
  const hasWrite = flags.has("write");
  if ((hasCheck ? 1 : 0) + (hasWrite ? 1 : 0) !== 1) throw new UsageError(USAGE);
  const mode = hasCheck ? "--check" : "--write";
  const targets = rest.length > 0 ? filterPrettierPaths(rest) : [...PRETTIER_GLOBS];
  return { mode, targets };
}

export function runPrettier(argv = process.argv.slice(2)) {
  const { mode, targets } = resolvePrettierTargets(argv);
  if (targets.length === 0) return 0;
  // Streams intentionally: formatting output is the user-facing result.
  const result = runStreamCommand(process.execPath, [prettierCli, mode, ...targets]);
  return result.status ?? 1;
}

if (isMainModule(import.meta.url)) {
  try {
    process.exitCode = runPrettier();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
