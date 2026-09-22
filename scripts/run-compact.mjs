#!/usr/bin/env node
import path from "node:path";
import { createRunId } from "./lib/verification/current-run.mjs";
import { failureSummary, completionCounts } from "./lib/compact-output.mjs";
import { runCommandAsync, runStreamCommand } from "./lib/run-command.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";

export { completionCounts };

const ROOT = path.resolve(import.meta.dirname, "..");
const USAGE =
  "Usage: npm run compact -- <command> [args...] (one-shot commands only; use normal commands for watch/debug sessions)";

export async function runCompact(argv, rootDir = ROOT) {
  if (argv[0] === "--") argv = argv.slice(1);
  if (argv.length === 1 && argv[0] === "--help") {
    console.log(USAGE);
    return 0;
  }
  const [command, ...args] = argv;
  if (!command || command.startsWith("--")) throw new UsageError(USAGE);
  // The outer gate already owns full logs and diagnostics. Interactive flags
  // retain their normal terminal behavior even through a one-shot npm entry.
  if (
    process.env.ALCHEMY_OUTPUT_CAPTURED === "1" ||
    args.some((arg) => ["--watch", "-w", "--ui", "--debug"].includes(arg))
  ) {
    return runStreamCommand(command, args, { cwd: rootDir }).status ?? 1;
  }
  const logPath = path.join(rootDir, "reports", "compact", createRunId("compact"), "output.log");
  console.log(`Running ${path.basename(command)}; full log: ${path.relative(rootDir, logPath)}`);
  const result = await runCommandAsync(command, args, { cwd: rootDir, logPath });
  const status = result.status ?? 1;
  console.log(`${status === 0 ? "PASS" : "FAIL"} (exit ${status}, ${(result.elapsedMs / 1000).toFixed(1)}s)`);
  const counts = completionCounts(result.output);
  if (counts) console.log(counts);
  if (status !== 0) console.error(failureSummary(result.output, 2_800));
  if (result.outputTruncated)
    console.log("Diagnostics use the bounded capture; search the full log for omitted output.");
  console.log(`Full log: ${path.relative(rootDir, logPath)}`);
  return status;
}

defineScript(import.meta.url, async () => {
  process.exitCode = await runCompact(process.argv.slice(2));
});
