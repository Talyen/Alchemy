#!/usr/bin/env node
import path from "node:path";
import { CONTEXT_TASKS, selectContext } from "./lib/agent/agent-context.mjs";
import { readDocumentSection } from "./lib/agent/markdown-sections.mjs";
import { resolveSelectedPaths } from "./lib/verification/changed-paths.mjs";
import { defineScript } from "./lib/script-run.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export function parseContextArgs(argv) {
  const tasks = [];
  const paths = [];
  const flags = new Set();
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--task") {
      const task = argv[++index];
      if (!task || task.startsWith("--")) throw new Error("--task requires a topic");
      tasks.push(task);
    } else if (arg === "--diff" || arg === "--json") flags.add(arg.slice(2));
    else if (arg === "--") continue;
    else if (arg.startsWith("--"))
      throw new Error(`Unknown context option: ${arg}. Use rg and direct reads for source and test navigation.`);
    else paths.push(arg);
  }
  if (paths.length && flags.has("diff")) throw new Error("Choose paths or --diff");
  return { paths, flags, tasks };
}
export function main(argv = process.argv.slice(2)) {
  if (!argv.length || argv.includes("--help")) {
    console.log(
      `Usage: npm run context -- [<paths> | --diff] [--task <topic> ...] [--json]\nTopics: ${Object.keys(CONTEXT_TASKS).join(", ")}\nOwner pointers with current line ranges; use scoped reads to inspect content.`,
    );
    return 0;
  }
  const options = parseContextArgs(argv.filter((arg) => arg !== "--"));
  if (!options.tasks.length && !options.paths.length && !options.flags.has("diff"))
    throw new Error("Provide paths, --diff, or --task <topic>");
  const paths = options.paths.length || options.flags.has("diff") ? resolveSelectedPaths(ROOT, options) : [];
  const selected = selectContext(paths, options.tasks);
  const selection = {
    ...selected,
    docs: selected.docs.map((doc) => {
      const { start, end } = readDocumentSection(ROOT, doc.path, doc.heading);
      return { ...doc, start, end };
    }),
  };
  if (options.flags.has("json")) console.log(JSON.stringify(selection, null, 2));
  else {
    console.log(`Topics: ${selection.tasks.join(", ") || "general"}`);
    for (const doc of selection.docs)
      console.log(`Owner: ${doc.path}:${doc.start}-${doc.end}${doc.heading ? ` # ${doc.heading}` : ""}`);
    for (const entry of selection.entrypoints) console.log(`Entry: ${entry}`);
    console.log("Pointers only; no document or source contents printed.");
  }
  return 0;
}
defineScript(import.meta.url, () => main());
