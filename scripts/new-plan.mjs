#!/usr/bin/env node
/** Scaffold a short-lived execution plan under docs/Plans/. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./lib/is-main-module.mjs";
import { PLANS_DIR } from "./lib/plan-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAME_PATTERN = /^[A-Za-z0-9._-]+$/u;

export function safePlanName(value) {
  if (!value || !NAME_PATTERN.test(value)) {
    throw new Error("Plan name must contain only letters, numbers, dots, underscores, and hyphens");
  }
  return value;
}

export function planTemplate(name, updated) {
  return `---
status: active
updated: ${updated}
---

# ${name}

## Objective

Describe the user-visible outcome and the bounded implementation scope.

## Plan

- [ ] Describe the task-specific implementation steps and meaningful verification.

## Notes

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](./README.md#task-handoff).
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
  fs.writeFileSync(target, planTemplate(safeName, now), "utf8");
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

if (isMainModule(import.meta.url)) main();
