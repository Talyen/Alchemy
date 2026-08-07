/**
 * Run measurable audit probes (knip, single-use, madge, complexity, amplification)
 * as a periodic sweep. Agent audit guides: docs/Audits/README.md.
 * Run: node scripts/audit-all.mjs
 *
 * Exits non-zero if any audit fails. Prints a summary at the end.
 * Local / agent periodic sweep (docs/Audits); not CI nightly and not a
 * pre-push gate (nightly runs `deadcode:strict` only; use `npm run lint:ci`
 * for the static gate).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(currentFile), "..");

const STEPS = [
  { name: "knip (deadcode:strict)", cmd: "npm", args: ["run", "deadcode:strict"], timeout: 180_000 },
  { name: "single-use abstractions", cmd: "node", args: ["scripts/audit-single-use.mjs"], timeout: 120_000 },
  {
    name: "madge (circular)",
    cmd: "npx",
    args: ["-y", "madge", "--circular", "--extensions", "ts", "--ts-config", "tsconfig.json", "src"],
    timeout: 120_000,
  },
  {
    name: "ESLint complexity + max-lines-per-function",
    cmd: "npx",
    args: [
      "eslint",
      "--rule",
      'complexity:["warn",11]',
      "--rule",
      'max-lines-per-function:["warn",{"max":50,"skipComments":true}]',
      "src",
    ],
    timeout: 180_000,
  },
  { name: "type-escape trend counts", cmd: "node", args: ["scripts/audit-type-escapes.mjs"], timeout: 60_000 },
  { name: "change amplification", cmd: "node", args: ["scripts/audit-change-amplification.mjs"], timeout: 60_000 },
];

let failed = 0;
const started = Date.now();
console.log("Running all measurable audits…\n");

for (const step of STEPS) {
  const t0 = Date.now();
  console.log(`── ${step.name} ──`);
  const r = spawnSync(step.cmd, step.args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    timeout: step.timeout,
  });
  const ms = Date.now() - t0;
  if (r.status !== 0) {
    failed++;
    console.log(`  ✗ failed (${ms}ms, exit ${r.status})\n`);
  } else {
    console.log(`  ✓ ok (${ms}ms)\n`);
  }
}

const totalMs = Date.now() - started;
console.log("─".repeat(60));
console.log(`Total: ${STEPS.length - failed}/${STEPS.length} passed in ${(totalMs / 1000).toFixed(1)}s`);
if (failed > 0) {
  console.log(`${failed} audit(s) failed — see output above`);
  process.exit(1);
}
