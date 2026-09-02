#!/usr/bin/env node
/** Rank route prereads and captured command-output exposure from recent runs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTINE_EXPOSURE_BUDGET_BYTES } from "./lib/compact-output.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { ROUTE_CONTEXT_BUDGETS, measureAllRoutes } from "./measure-agent-context.mjs";
import { readRecentRuns } from "./show-runs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export { ROUTINE_EXPOSURE_BUDGET_BYTES };

export function parseContextHotspotArgs(argv) {
  let last = 20;
  let minBytes = 4_000;
  let json = false;
  let check = false;
  let runId;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--last") last = Number(argv[++index]);
    else if (arg.startsWith("--last=")) last = Number(arg.slice("--last=".length));
    else if (arg === "--run-id") runId = String(argv[++index] ?? "").trim();
    else if (arg.startsWith("--run-id=")) runId = String(arg.slice("--run-id=".length)).trim();
    else if (arg === "--min-bytes") minBytes = Number(argv[++index]);
    else if (arg.startsWith("--min-bytes=")) minBytes = Number(arg.slice("--min-bytes=".length));
    else if (arg === "--json") json = true;
    else if (arg === "--check") check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (runId !== undefined && runId.length === 0) throw new Error("--run-id requires a value");
  if (runId !== undefined && last !== 20) throw new Error("Use --run-id or --last, not both");
  if (!Number.isInteger(last) || last < 1) throw new Error("--last must be a positive integer");
  if (!Number.isInteger(minBytes) || minBytes < 0) throw new Error("--min-bytes must be a non-negative integer");
  return { last, minBytes, json, check, runId };
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

export function readRunById(rootDir, runId) {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, "reports", "runs", runId, "run.json"), "utf8"));
  } catch {
    return null;
  }
}

export function buildContextHotspotReport(rootDir, options = {}) {
  let runs;
  if (options.runId) {
    const single = readRunById(rootDir, options.runId);
    runs = single ? [single] : [];
  } else {
    runs = readRecentRuns(rootDir, { last: options.last ?? 20 });
  }
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

export function checkRouteBudgets(routes = measureAllRoutes()) {
  const over = [];
  for (const row of routes) {
    const id = row.routes.length === 1 ? row.routes[0] : null;
    const budget = id ? ROUTE_CONTEXT_BUDGETS[id] : null;
    if (!budget) continue;
    if (row.selectedBytes > budget.preread || row.totalContextBytes > budget.total) {
      over.push({
        routes: row.routes,
        selectedBytes: row.selectedBytes,
        totalContextBytes: row.totalContextBytes,
        budget,
      });
    }
  }
  return over;
}

export function main(argv = process.argv.slice(2), rootDir = ROOT) {
  try {
    const options = parseContextHotspotArgs(argv);
    const report = buildContextHotspotReport(rootDir, options);
    const overBudgetRoutes = checkRouteBudgets(report.routes);
    if (overBudgetRoutes.length > 0 && !options.json) {
      console.log("Routes over preread/total budget:");
      for (const row of overBudgetRoutes) {
        console.log(
          `  ${row.routes.join("+")}: preread ${row.selectedBytes.toLocaleString()} B (budget ${row.budget.preread.toLocaleString()}); ` +
            `total ${row.totalContextBytes.toLocaleString()} B (budget ${row.budget.total.toLocaleString()})`,
        );
      }
      console.log("");
    }
    console.log(
      options.json ? JSON.stringify({ ...report, overBudgetRoutes }, null, 2) : formatContextHotspotReport(report),
    );
    if (!options.check) return 0;
    return report.commands.some((command) => command.overBudgetOccurrences > 0) || overBudgetRoutes.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = main();
