#!/usr/bin/env node
/** Rank route prereads and captured command-output exposure from recent runs. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTINE_EXPOSURE_BUDGET_BYTES } from "./lib/compact-output.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { measureAllRoutes } from "./measure-agent-context.mjs";
import { readRecentRuns } from "./show-runs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export { ROUTINE_EXPOSURE_BUDGET_BYTES };

export function parseContextHotspotArgs(argv) {
  let last = 20;
  let minBytes = 4_000;
  let json = false;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--last") last = Number(argv[++index]);
    else if (arg.startsWith("--last=")) last = Number(arg.slice("--last=".length));
    else if (arg === "--min-bytes") minBytes = Number(argv[++index]);
    else if (arg.startsWith("--min-bytes=")) minBytes = Number(arg.slice("--min-bytes=".length));
    else if (arg === "--json") json = true;
    else if (arg === "--check") check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(last) || last < 1) throw new Error("--last must be a positive integer");
  if (!Number.isInteger(minBytes) || minBytes < 0) throw new Error("--min-bytes must be a non-negative integer");
  return { last, minBytes, json, check };
}

export function aggregateCommandExposures(runs, minBytes = 0) {
  const groups = new Map();
  for (const run of runs) {
    for (const entry of Array.isArray(run.commandExposures) ? run.commandExposures : []) {
      const key = String(entry.key ?? entry.command ?? "command");
      const group = groups.get(key) ?? {
        key,
        label: String(entry.label ?? key),
        occurrences: 0,
        failures: 0,
        rawBytes: 0,
        exposedBytes: 0,
        maxExposedBytes: 0,
        overBudgetOccurrences: 0,
        maxRawBytes: 0,
        rawLines: 0,
      };
      const rawBytes = Math.max(0, Number(entry.rawBytes) || 0);
      const exposedBytes = Math.max(0, Number(entry.exposedBytes) || 0);
      group.occurrences += 1;
      group.failures += entry.status == null || Number(entry.status) === 0 ? 0 : 1;
      group.rawBytes += rawBytes;
      group.exposedBytes += exposedBytes;
      group.maxExposedBytes = Math.max(group.maxExposedBytes, exposedBytes);
      group.overBudgetOccurrences +=
        entry.overBudget === true ||
        (entry.budgetBytes !== null && exposedBytes > Number(entry.budgetBytes ?? ROUTINE_EXPOSURE_BUDGET_BYTES))
          ? 1
          : 0;
      group.maxRawBytes = Math.max(group.maxRawBytes, rawBytes);
      group.rawLines += Math.max(0, Number(entry.rawLines) || 0);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .filter((group) => group.rawBytes >= minBytes)
    .map((group) => ({
      ...group,
      avoidedPercent:
        group.rawBytes === 0
          ? 0
          : Math.max(0, Math.round(((group.rawBytes - group.exposedBytes) / group.rawBytes) * 1_000) / 10),
    }))
    .sort((a, b) => b.rawBytes - a.rawBytes || b.maxRawBytes - a.maxRawBytes || a.key.localeCompare(b.key));
}

export function buildContextHotspotReport(rootDir, options = {}) {
  const runs = readRecentRuns(rootDir, { last: options.last ?? 20 });
  return {
    generatedAt: new Date().toISOString(),
    inspectedRuns: runs.length,
    routes: measureAllRoutes(),
    commands: aggregateCommandExposures(runs, options.minBytes ?? 4_000),
  };
}

function formatBytes(value) {
  return `${Number(value).toLocaleString()} B`;
}

export function formatContextHotspotReport(report) {
  const lines = ["Route context hotspots:"];
  for (const row of report.routes) {
    lines.push(
      `  ${row.routes.join("+")}: ${formatBytes(row.totalContextBytes)} ` +
        `(preread ${formatBytes(row.selectedBytes)}; fixture ${formatBytes(row.changedFileBytes)})`,
    );
  }
  lines.push("", `Captured command-output hotspots (${report.inspectedRuns} recent runs):`);
  if (report.commands.length === 0) lines.push("  No recorded commands met the byte threshold.");
  for (const row of report.commands) {
    lines.push(
      `  ${row.label}: ${formatBytes(row.rawBytes)} raw / ${formatBytes(row.exposedBytes)} exposed ` +
        `(${row.avoidedPercent}% avoided; ${row.occurrences} runs; max raw ${formatBytes(row.maxRawBytes)}` +
        `${row.overBudgetOccurrences > 0 ? `; ${row.overBudgetOccurrences} over budget` : ""})`,
    );
  }
  return lines.join("\n");
}

export function main(argv = process.argv.slice(2), rootDir = ROOT) {
  try {
    const options = parseContextHotspotArgs(argv);
    const report = buildContextHotspotReport(rootDir, options);
    console.log(options.json ? JSON.stringify(report, null, 2) : formatContextHotspotReport(report));
    return options.check && report.commands.some((command) => command.overBudgetOccurrences > 0) ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = main();
