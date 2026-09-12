#!/usr/bin/env node
/** Move terminal execution plans out of the active plans directory. */
import fs from "node:fs";
import path from "node:path";
import { parsePlanMetadata } from "./check-plans.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { PLANS_DIR } from "./lib/plan-contract.mjs";

const TERMINAL_STATUSES = new Set(["complete", "cancelled"]);

/** Preserve local link destinations when a plan moves, including links between moved plans. */
function rebasePlanLinks(content, source, destination, moves) {
  const rebase = (target) => {
    const angle = target.startsWith("<");
    const value = angle ? target.slice(1, -1) : target;
    if (/^(?:[a-z][a-z0-9+.-]*:|[/#])/iu.test(value)) return target;
    const [, pathname, suffix] = /^([^?#]*)(.*)$/u.exec(value);
    if (!pathname) return target;
    const original = path.resolve(path.dirname(source), decodeURIComponent(pathname));
    const relative = path
      .relative(path.dirname(destination), moves.get(original) ?? original)
      .replaceAll(path.sep, "/");
    const encoded = relative.split("/").map(encodeURIComponent).join("/") + suffix;
    return angle ? `<${encoded}>` : encoded;
  };
  let fence = null;
  return content
    .split(/(\r?\n)/u)
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
      if (marker) {
        if (!fence) fence = marker;
        else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
        return line;
      }
      if (fence) return line;
      return line
        .replace(/(`+)[^`]*?\1|(!?\[[^\]\n]*\]\(\s*)(<[^>\n]+>|[^\s)]+)/gu, (match, code, prefix, target) =>
          code ? match : prefix + rebase(target),
        )
        .replace(/^( {0,3}\[[^\]\n]+\]:\s*)(<[^>\n]+>|\S+)/u, (_match, prefix, target) => prefix + rebase(target));
    })
    .join("");
}

export function archiveTerminalPlans({ plansDir = PLANS_DIR, names = [], dryRun = false } = {}) {
  plansDir = path.resolve(plansDir);
  for (const name of names) {
    if (!/^[A-Za-z0-9._-]+\.md$/u.test(name) || name === "README.md") {
      throw new Error(`Expected a plan filename such as ExamplePlan.md: ${name}`);
    }
    if (!fs.existsSync(path.join(plansDir, name))) throw new Error(`Plan not found: ${name}`);
  }
  const archiveDir = path.join(plansDir, "Archived");
  const candidates = fs
    .readdirSync(plansDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .filter((entry) => names.length === 0 || names.includes(entry.name))
    .map((entry) => {
      const source = path.join(plansDir, entry.name);
      const content = fs.readFileSync(source, "utf8");
      const parsed = parsePlanMetadata(content);
      if (parsed.errors.length > 0) throw new Error(`${entry.name}: ${parsed.errors.join("; ")}`);
      if (names.length > 0 && !TERMINAL_STATUSES.has(parsed.metadata.status)) {
        throw new Error(`${entry.name}: finish or cancel the plan before archiving`);
      }
      return { name: entry.name, source, content, status: parsed.metadata.status };
    })
    .filter((entry) => TERMINAL_STATUSES.has(entry.status));

  for (const candidate of candidates) {
    const destination = path.join(archiveDir, candidate.name);
    if (fs.existsSync(destination)) throw new Error(`Archive already contains ${candidate.name}`);
  }

  const moves = new Map(candidates.map(({ source, name }) => [source, path.join(archiveDir, name)]));
  const prepared = candidates.map((candidate) => ({
    ...candidate,
    destination: moves.get(candidate.source),
    rebased: rebasePlanLinks(candidate.content, candidate.source, moves.get(candidate.source), moves),
  }));
  if (!dryRun) {
    if (candidates.length > 0) fs.mkdirSync(archiveDir, { recursive: true });
    for (const candidate of prepared) {
      fs.writeFileSync(candidate.destination, candidate.rebased, { flag: "wx" });
      fs.unlinkSync(candidate.source);
    }
  }
  return candidates.map((candidate) => path.join("docs", "Plans", "Archived", candidate.name));
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: npm run archive:plans -- [PlanName.md ...] [--dry-run]");
    return;
  }
  try {
    const dryRun = argv.includes("--dry-run");
    const names = argv.filter((arg) => arg !== "--dry-run");
    const archived = archiveTerminalPlans({ names, dryRun });
    if (archived.length === 0) console.log("No completed plans to archive.");
    for (const plan of archived) console.log(`${dryRun ? "Would archive" : "Archived"} ${plan}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (isMainModule(import.meta.url)) main();
