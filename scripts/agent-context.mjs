#!/usr/bin/env node
import path from "node:path";
import { CONTEXT_TASKS, selectContext } from "./lib/agent/agent-context.mjs";
import { resolveSelectedPaths } from "./lib/verification/changed-paths.mjs";
import { defineScript } from "./lib/script-run.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export function parseContextArgs(argv) {
  const args = [...argv];
  const index = args.indexOf("--task");
  let task;
  if (index >= 0) {
    task = args[index + 1];
    if (!task || task.startsWith("--")) throw new Error("--task requires a topic");
    args.splice(index, 2);
  }
  const flags = new Set(args.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
  const paths = args.filter((arg) => arg !== "--" && !arg.startsWith("--"));
  for (const flag of flags)
    if (!["diff", "json"].includes(flag))
      throw new Error(`Unknown context option: --${flag}. Use rg and direct reads for source and test navigation.`);
  if (paths.length && flags.has("diff")) throw new Error("Choose paths or --diff");
  return { paths, flags, task };
}
export function main(argv = process.argv.slice(2)) {
  if (!argv.length || argv.includes("--help")) {
    console.log(
      `Usage: npm run context -- <paths> | --task <topic> | --diff [--json]\nTopics: ${Object.keys(CONTEXT_TASKS).join(", ")}\nOwner pointers only; use rg and direct file reads to inspect content.`,
    );
    return 0;
  }
  const options = parseContextArgs(argv.filter((arg) => arg !== "--"));
  if (!options.task && !options.paths.length && !options.flags.has("diff"))
    throw new Error("Provide paths, --diff, or --task <topic>");
  const paths = options.paths.length || options.flags.has("diff") ? resolveSelectedPaths(ROOT, options) : [];
  const selection = selectContext(paths, options.task);
  if (options.flags.has("json")) console.log(JSON.stringify(selection, null, 2));
  else {
    console.log(`Topics: ${selection.tasks.join(", ") || "general"}`);
    for (const doc of selection.docs) console.log(`Owner: ${doc.path}${doc.heading ? ` # ${doc.heading}` : ""}`);
    for (const entry of selection.entrypoints) console.log(`Entry: ${entry}`);
    console.log("Pointers only; no document or source contents were read.");
  }
  return 0;
}
defineScript(import.meta.url, () => main());
