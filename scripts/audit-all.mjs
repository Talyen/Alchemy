/**
 * Run measurable audit probes (knip, madge, complexity, amplification)
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
import { tailOutput, writeDiagnosticLog } from "./lib/compact-output.mjs";
import { writeCurrentRun } from "./lib/current-run.mjs";

const currentFile = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(currentFile), "..");
const verbose = process.argv.includes("--verbose");

const STEPS = [
  { name: "knip (deadcode:strict)", cmd: "npm", args: ["run", "deadcode:strict"], timeout: 180_000 },
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
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    timeout: step.timeout,
  });
  const ms = Date.now() - t0;
  const output = [r.stdout ?? "", r.stderr ?? "", r.error?.message ?? ""].filter(Boolean).join("\n");
  if (verbose && output) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  if (r.status !== 0) {
    failed++;
    const safeName = step.name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
    const logPath = writeDiagnosticLog(path.join(ROOT, "reports", "audit-all"), safeName, output);
    console.log(`  ✗ failed (${ms}ms, exit ${r.status ?? "unknown"})`);
    console.log(`  ${tailOutput(output)}`);
    console.log(`  Full output: ${path.relative(ROOT, logPath)}\n`);
  } else {
    console.log(`  ✓ ok (${ms}ms)\n`);
  }
}

const totalMs = Date.now() - started;
console.log("─".repeat(60));
console.log(`Total: ${STEPS.length - failed}/${STEPS.length} passed in ${(totalMs / 1000).toFixed(1)}s`);
writeCurrentRun({
  rootDir: ROOT,
  status: failed > 0 ? "failed" : "passed",
  command: "npm run audit:all",
  artifacts: ["reports/audit-all"],
  summary: `${STEPS.length - failed}/${STEPS.length} audit probes passed.`,
});
if (failed > 0) {
  console.log(`${failed} audit(s) failed — see output above`);
  process.exit(1);
}
