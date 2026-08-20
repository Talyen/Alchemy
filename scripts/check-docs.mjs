#!/usr/bin/env node
/** Validate the short-lived execution-plan contract under docs/Plans/. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLANS_DIR = path.join(ROOT, "docs", "Plans");
const REQUIRED_KEYS = ["type", "status", "created", "updated", "expires"];
const PLAN_STATUSES = new Set(["active", "blocked", "complete", "cancelled"]);
const PLAN_WARNING_DAYS = 3;

function isoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

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

  for (const key of REQUIRED_KEYS) if (!metadata[key]) errors.push(`missing ${key}`);
  if (metadata.type && metadata.type !== "execution-plan") errors.push("type must be execution-plan");
  if (metadata.status && !PLAN_STATUSES.has(metadata.status)) {
    errors.push(`status must be one of ${[...PLAN_STATUSES].sort().join(", ")}`);
  }
  if (metadata.status === "blocked" && !metadata.reason) errors.push("blocked plans require reason");

  const dates = {};
  for (const key of ["created", "updated", "expires"]) {
    if (!metadata[key]) continue;
    const date = isoDate(metadata[key]);
    if (!date) errors.push(`${key} must be an ISO date`);
    else dates[key] = date;
  }
  if (dates.created && dates.updated && dates.updated < dates.created) {
    errors.push("updated must not precede created");
  }
  if (dates.updated && dates.expires && dates.expires <= dates.updated) {
    errors.push("expires must be later than updated");
  }
  return { metadata, errors, dates };
}

export function planFiles() {
  if (!fs.existsSync(PLANS_DIR)) return [];
  return fs
    .readdirSync(PLANS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => path.join(PLANS_DIR, entry.name))
    .sort();
}

export function checkPlans({ final = false, keepPlan = false, today = new Date() } = {}) {
  const failures = [];
  const warnings = [];
  const plans = planFiles();
  if (!fs.existsSync(path.join(PLANS_DIR, "README.md"))) failures.push("docs/Plans/README.md is missing");

  let activePlans = 0;
  for (const planPath of plans) {
    const relative = path.relative(ROOT, planPath);
    const result = parsePlanMetadata(fs.readFileSync(planPath, "utf8"));
    if (result.errors.length > 0) {
      failures.push(`${relative}: ${result.errors.join("; ")}`);
      continue;
    }
    const { metadata, dates } = result;
    if (metadata.status === "complete" || metadata.status === "cancelled") {
      failures.push(`${relative}: ${metadata.status} plans must be deleted`);
      continue;
    }
    if (dates.expires <= today) {
      failures.push(`${relative}: ${metadata.status} plan expired on ${metadata.expires}; update or delete it`);
    } else if (dates.expires <= new Date(today.getTime() + PLAN_WARNING_DAYS * 86_400_000)) {
      warnings.push(`${relative}: ${metadata.status} plan expires on ${metadata.expires}; renew or close it`);
    }
    if (metadata.status === "active") {
      activePlans += 1;
      if (final && !keepPlan) {
        failures.push(`${relative}: active plan remains at final handoff; delete it or pass --keep-plan`);
      }
    }
  }
  if (activePlans > 3) warnings.push(`docs/Plans/: ${activePlans} active plans are present`);
  return { failures, warnings, activePlans };
}

function main(argv = process.argv.slice(2)) {
  const flags = new Set(argv);
  if (flags.has("--help") || flags.has("-h")) {
    console.log("Usage: npm run docs:check [--final] [--keep-plan]");
    return 0;
  }
  const unknown = [...flags].filter((flag) => !["--final", "--keep-plan"].includes(flag));
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(", ")}`);
    return 2;
  }
  const result = checkPlans({ final: flags.has("--final"), keepPlan: flags.has("--keep-plan") });
  if (result.failures.length > 0) {
    console.error("Plan checks failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    return 1;
  }
  console.log(`Plan checks passed (${result.activePlans} active plan${result.activePlans === 1 ? "" : "s"}).`);
  for (const warning of result.warnings) console.error(`Warning: ${warning}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
