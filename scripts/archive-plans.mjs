#!/usr/bin/env node
/** Move terminal execution plans out of the active plans directory. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePlanMetadata } from "./check-docs.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLANS_DIR = path.join(ROOT, "docs", "Plans");
const TERMINAL_STATUSES = new Set(["complete", "cancelled"]);

export function archiveTerminalPlans({ plansDir = PLANS_DIR } = {}) {
  const archiveDir = path.join(plansDir, "Archived");
  const candidates = fs
    .readdirSync(plansDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => {
      const source = path.join(plansDir, entry.name);
      const parsed = parsePlanMetadata(fs.readFileSync(source, "utf8"));
      if (parsed.errors.length > 0) throw new Error(`${entry.name}: ${parsed.errors.join("; ")}`);
      return { name: entry.name, source, status: parsed.metadata.status };
    })
    .filter((entry) => TERMINAL_STATUSES.has(entry.status));

  for (const candidate of candidates) {
    const destination = path.join(archiveDir, candidate.name);
    if (fs.existsSync(destination)) throw new Error(`Archive already contains ${candidate.name}`);
  }

  if (candidates.length > 0) fs.mkdirSync(archiveDir, { recursive: true });
  for (const candidate of candidates) fs.renameSync(candidate.source, path.join(archiveDir, candidate.name));
  return candidates.map((candidate) => path.join("docs", "Plans", "Archived", candidate.name));
}

function main() {
  try {
    const archived = archiveTerminalPlans();
    if (archived.length === 0) console.log("No completed plans to archive.");
    for (const plan of archived) console.log(`Archived ${plan}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (isMainModule(import.meta.url)) main();
