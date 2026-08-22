#!/usr/bin/env node
/** Validate the short-lived execution-plan contract under docs/Plans/. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isoDate, PLAN_STALE_DAYS, PLAN_STATUSES, REQUIRED_PLAN_KEYS } from "./lib/plan-contract.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLANS_DIR = path.join(ROOT, "docs", "Plans");
export function parsePlanMetadata(source) {
  const lines = source.split(/\r?\n/u);
  if (lines[0]?.trim() !== "---") return { metadata: {}, errors: ["missing front matter"] };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { metadata: {}, errors: ["front matter is not closed"] };

  const metadata = {};
  const errors = [];
  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue;
    const match = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.+)$/u.exec(line);
    if (!match) {
      errors.push(`invalid metadata line ${JSON.stringify(line)}`);
      continue;
    }
    metadata[match[1]] = match[2].trim();
  }

  for (const key of REQUIRED_PLAN_KEYS) if (!metadata[key]) errors.push(`missing ${key}`);
  if (metadata.status && !PLAN_STATUSES.includes(metadata.status)) {
    errors.push(`status must be one of ${[...PLAN_STATUSES].sort().join(", ")}`);
  }
  if (metadata.status === "blocked" && !metadata.reason) errors.push("blocked plans require reason");

  let updated;
  if (metadata.updated) {
    updated = isoDate(metadata.updated);
    if (!updated) errors.push("updated must be an ISO date");
  }
  return { metadata, errors, updated };
}

export function planFiles() {
  if (!fs.existsSync(PLANS_DIR)) return [];
  return fs
    .readdirSync(PLANS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => path.join(PLANS_DIR, entry.name))
    .sort();
}

export function checkPlans({ final = false, today = new Date() } = {}) {
  const failures = [];
  const warnings = [];
  const plans = planFiles();
  if (!fs.existsSync(path.join(PLANS_DIR, "README.md"))) failures.push("docs/Plans/README.md is missing");

  for (const planPath of plans) {
    const relative = path.relative(ROOT, planPath);
    const result = parsePlanMetadata(fs.readFileSync(planPath, "utf8"));
    if (result.errors.length > 0) {
      failures.push(`${relative}: ${result.errors.join("; ")}`);
      continue;
    }
    const { metadata, updated } = result;
    if (metadata.status === "complete" || metadata.status === "cancelled") {
      failures.push(
        `${relative}: ${metadata.status} plans are deleted at handoff — remove the file (git history keeps it)`,
      );
      continue;
    }
    if (updated.getTime() <= today.getTime() - PLAN_STALE_DAYS * 86_400_000) {
      warnings.push(`${relative}: not updated since ${metadata.updated}; finish and delete it or refresh \`updated\``);
    }
    if (final) failures.push(`${relative}: plan remains at final handoff; delete it once its work is done`);
  }
  if (plans.length > 3) warnings.push(`docs/Plans/: ${plans.length} active plan files are present`);
  return { failures, warnings, activePlans: plans.length };
}

function main(argv = process.argv.slice(2)) {
  const flags = new Set(argv);
  if (flags.has("--help") || flags.has("-h")) {
    console.log("Usage: npm run docs:check [--final]");
    return 0;
  }
  const unknown = [...flags].filter((flag) => flag !== "--final");
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(", ")}`);
    return 2;
  }
  const result = checkPlans({ final: flags.has("--final") });
  if (result.failures.length > 0) {
    console.error("Plan checks failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    return 1;
  }
  console.log(`Plan checks passed (${result.activePlans} plan file${result.activePlans === 1 ? "" : "s"}).`);
  for (const warning of result.warnings) console.error(`Warning: ${warning}`);
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
