#!/usr/bin/env node
/**
 * Compare two performance report directories.
 * Usage: node scripts/compare-performance.mjs <beforeDir> <afterDir>
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [before, after] = process.argv.slice(2);
if (!before || !after) {
  console.error("Usage: npm run perf:compare -- <beforeDir> <afterDir>");
  process.exit(1);
}

const result = spawnSync("node", ["scripts/run-performance.mjs", "--compare", before, after], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
