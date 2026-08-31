/**
 * Run measurable audit probes (knip, madge, complexity, amplification, content).
 * as a periodic sweep. Agent audit guides: docs/Audits/README.md.
 * Run: node scripts/audit-all.mjs
 *
 * Exits non-zero if any audit fails. Prints a summary at the end.
 * Local / agent periodic sweep (docs/Audits); not CI nightly and not a
 * pre-push gate (nightly runs `deadcode:strict` only; use `npm run lint:ci`
 * for the static gate).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commandExposure, tailOutput, writeDiagnosticLog } from "./lib/compact-output.mjs";
import { writeCurrentRun } from "./lib/current-run.mjs";
import { runCommandAsync } from "./lib/run-command.mjs";

const currentFile = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(currentFile), "..");
const verbose = process.argv.includes("--verbose");

const STEPS = [
  { name: "knip (deadcode:strict)", cmd: "npm", args: ["run", "deadcode:strict"], timeout: 180_000 },
  {
    name: "depcruise (circular)",
    cmd: "npx",
    args: [
      "depcruise",
      "--include-only",
      "^src",
      "--config",
      "dependency-cruiser.config.mjs",
      "--output-type",
      "err",
      "src",
    ],
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
  { name: "content-audit", cmd: "node", args: ["scripts/content-audit.mjs"], timeout: 180_000 },
];

const started = Date.now();
console.log("Running all measurable audits…\n");

// Probes are independent and output is captured, so they run concurrently and
// results print in a stable order once all have finished.
const outcomes = await Promise.all(
  STEPS.map(async (step) => ({
    step,
    r: await runCommandAsync(step.cmd, step.args, { cwd: ROOT, timeout: step.timeout }),
  })),
);

let failed = 0;
const commandExposures = [];
for (const { step, r } of outcomes) {
  const ms = r.elapsedMs;
  const { output } = r;
  const verboseOutput = verbose && output ? output : "";
  if (verboseOutput) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  let exposedOutput = verboseOutput;
  let failureTail = "";
  if (r.status !== 0) {
    failureTail = tailOutput(output);
    exposedOutput = verboseOutput ? `${verboseOutput}\n${failureTail}` : failureTail;
  }
  const exposure = commandExposure({
    key: step.name,
    label: step.name,
    command: `${step.cmd} ${step.args.join(" ")}`,
    result: r,
    exposedOutput,
    budgetBytes: verbose ? null : undefined,
  });
  commandExposures.push(exposure);
  if (r.status !== 0) {
    failed++;
    const safeName = step.name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
    const logPath = writeDiagnosticLog(path.join(ROOT, "reports", "audit-all"), safeName, output);
    console.log(`── ${step.name} ──`);
    console.log(`  ✗ failed (${ms}ms, exit ${r.status ?? "unknown"})`);
    console.log(`  ${failureTail}`);
    console.log(`  Full output: ${path.relative(ROOT, logPath)}\n`);
  } else if (exposure.overBudget) {
    failed++;
    const safeName = step.name.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
    const logPath = writeDiagnosticLog(path.join(ROOT, "reports", "audit-all"), safeName, output);
    console.log(`── ${step.name} ──`);
    console.log(
      `  ✗ exposed ${exposure.exposedBytes.toLocaleString()} bytes; ` +
        `routine budget is ${exposure.budgetBytes?.toLocaleString()} bytes`,
    );
    console.log(`  Full output: ${path.relative(ROOT, logPath)}\n`);
  } else {
    console.log(`── ${step.name} ── ✓ ok (${ms}ms)\n`);
  }
}

const totalMs = Date.now() - started;
console.log("─".repeat(60));
console.log(`Total: ${STEPS.length - failed}/${STEPS.length} passed in ${(totalMs / 1000).toFixed(1)}s`);
writeCurrentRun({
  rootDir: ROOT,
  status: failed > 0 ? "failed" : "passed",
  command: "npm run audit:all",
  artifacts: [{ path: "reports/audit-all", role: "secondary" }],
  commandExposures,
  summary: `${STEPS.length - failed}/${STEPS.length} audit probes passed.`,
});
if (failed > 0) {
  console.log(`${failed} audit(s) failed — see output above`);
  process.exit(1);
}
