#!/usr/bin/env node
/** Delete explicitly selected terminal plans after moving durable guidance to its owner. */
import fs from "node:fs";
import path from "node:path";
import { parsePlanMetadata } from "./lib/plan-checks.mjs";
import { PLANS_DIR } from "./lib/plan-contract.mjs";
import { defineScript } from "./lib/script-run.mjs";

export function finishTerminalPlans({ plansDir = PLANS_DIR, names = [], dryRun = false } = {}) {
  if (!names.length) throw new Error("Name the completed or cancelled plans to finish");
  if (fs.lstatSync(plansDir).isSymbolicLink()) throw new Error("Plan directory must not be a symlink");
  const selected = [...new Set(names)].map((name) => {
    if (!/^[A-Za-z0-9._-]+\.md$/u.test(name) || name === "README.md")
      throw new Error(`Expected a plan filename such as ExamplePlan.md: ${name}`);
    const file = path.join(plansDir, name);
    const stats = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stats?.isFile() || stats.isSymbolicLink()) throw new Error(`Plan not found or not a regular file: ${name}`);
    const parsed = parsePlanMetadata(fs.readFileSync(file, "utf8"));
    if (parsed.errors.length) throw new Error(`${name}: ${parsed.errors.join("; ")}`);
    if (!["complete", "cancelled"].includes(parsed.metadata.status))
      throw new Error(`${name}: finish or cancel the plan before deleting it`);
    return { file, name };
  });
  if (!dryRun) for (const { file } of selected) fs.unlinkSync(file);
  return selected.map(({ name }) => path.join("Docs", "Plans", name));
}

defineScript(import.meta.url, () => {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: npm run finish:plans -- <PlanName.md ...> [--dry-run]");
    return;
  }
  const dryRun = args.includes("--dry-run");
  for (const name of finishTerminalPlans({ names: args.filter((arg) => arg !== "--dry-run"), dryRun }))
    console.log(`${dryRun ? "Would remove" : "Removed"} ${name}`);
});
