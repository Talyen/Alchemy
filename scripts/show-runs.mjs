#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseShowRunsArgs(argv) {
  let last = 10;
  let status;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--last") {
      last = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--last=")) last = Number(arg.slice("--last=".length));
    else if (arg === "--status") {
      status = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--status=")) status = arg.slice("--status=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(last) || last < 1) throw new Error("--last must be a positive integer");
  if (status !== undefined && !["passed", "failed", "unknown", "missing-report"].includes(status)) {
    throw new Error(`Unknown status: ${status}`);
  }
  return { last, status };
}

export function readRecentRuns(rootDir, options = {}) {
  const runsDir = path.join(rootDir, "reports", "runs");
  if (!fs.existsSync(runsDir)) return [];
  return fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const record = JSON.parse(fs.readFileSync(path.join(runsDir, entry.name, "run.json"), "utf8"));
        return record && typeof record === "object" ? [record] : [];
      } catch {
        return [];
      }
    })
    .filter((record) => !options.status || record.status === options.status)
    .sort((a, b) => String(a.generatedAt).localeCompare(String(b.generatedAt)))
    .slice(-(options.last ?? 10));
}

export function formatRecentRun(rootDir, record) {
  const counts = record.counts
    ? Object.entries(record.counts)
        .map(([key, value]) => `${key} ${value}`)
        .join(", ")
    : "no counts";
  const primary = Array.isArray(record.artifacts)
    ? record.artifacts.filter((artifact) => artifact.role === "primary")
    : [];
  const evidence =
    primary.length === 0
      ? "no primary evidence"
      : primary.every((artifact) => fs.existsSync(path.resolve(rootDir, artifact.path)))
        ? "evidence available"
        : "evidence pruned/missing";
  const summary =
    String(record.summary ?? "")
      .replaceAll(/\s+/gu, " ")
      .slice(0, 160) || "—";
  return `${record.generatedAt} | ${record.runId} | ${record.status} | ${record.command} | ${counts} | ${evidence} | ${summary}`;
}

export function main(argv = process.argv.slice(2), rootDir = ROOT) {
  try {
    const options = parseShowRunsArgs(argv);
    const runs = readRecentRuns(rootDir, options);
    if (runs.length === 0) {
      console.log("No matching run records under reports/runs.");
      return 0;
    }
    for (const run of runs) console.log(formatRecentRun(rootDir, run));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = main();
