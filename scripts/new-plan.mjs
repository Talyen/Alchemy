#!/usr/bin/env node
/** Scaffold a short-lived execution plan under docs/Plans/. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLANS_DIR = path.join(ROOT, "docs", "Plans");
const NAME_PATTERN = /^[A-Za-z0-9._-]+$/u;

export function safePlanName(value) {
  if (!value || !NAME_PATTERN.test(value)) {
    throw new Error("Plan name must contain only letters, numbers, dots, underscores, and hyphens");
  }
  return value;
}

export function planTemplate(name, created, expires) {
  return `---
type: execution-plan
status: active
created: ${created}
updated: ${created}
expires: ${expires}
---

# ${name}

## Objective

Describe the user-visible outcome and the bounded implementation scope.

## Plan

- [ ] Record the baseline and relevant constraints.
- [ ] Implement the smallest complete change.
- [ ] Add or extend only consequential coverage.
- [ ] Run path-scoped verification.
- [ ] Mark the work complete, delete this file, and report verification.

## Notes

Keep durable policy in its canonical documentation owner. Delete this plan when the work is complete.
`;
}

function utcDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function createPlan(name, now = utcDate()) {
  const safeName = safePlanName(name);
  const target = path.join(PLANS_DIR, `${safeName}.md`);
  if (fs.existsSync(target)) throw new Error(`Plan already exists: docs/Plans/${safeName}.md`);
  fs.mkdirSync(PLANS_DIR, { recursive: true });
  const expires = new Date(`${now}T00:00:00Z`);
  expires.setUTCDate(expires.getUTCDate() + 14);
  fs.writeFileSync(target, planTemplate(safeName, now, expires.toISOString().slice(0, 10)), "utf8");
  return path.relative(ROOT, target);
}

function main() {
  const name = process.argv[2];
  if (name === "--help" || name === "-h") {
    console.log("Usage: npm run new:plan -- <PlanName>");
    return;
  }
  if (!name || process.argv.length > 3) {
    console.error("Usage: npm run new:plan -- <PlanName>");
    process.exitCode = 2;
    return;
  }
  try {
    console.log(`Created ${createPlan(name)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
