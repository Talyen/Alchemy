#!/usr/bin/env node
import path from "node:path";

import { CONTEXT_TASKS, selectContext, contextSections, sourceOutline } from "./lib/agent-context.mjs";
import { resolveSelectedPaths } from "./lib/changed-paths.mjs";
import { recordAgentEvent, readExposure } from "./lib/agent-events.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export const CONTEXT_OUTPUT_BYTES = 12_000;

export function parseContextArgs(argv) {
  const options = { paths: [], task: null, outline: null, symbol: null, diff: false, json: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (["--task", "--outline", "--symbol"].includes(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
    } else if (arg === "--diff") options.diff = true;
    else if (arg === "--json") options.json = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else options.paths.push(arg);
  }
  if (options.diff && options.paths.length) throw new Error("Choose explicit paths or --diff, not both.");
  if (options.symbol && !options.outline) throw new Error("--symbol requires --outline <file>");
  return options;
}

export function renderContext(selection, sections, budget = CONTEXT_OUTPUT_BYTES) {
  const lines = [
    `Tasks: ${selection.tasks.join(", ") || "general"}`,
    ...selection.entrypoints.map((file) => `Entry: ${file}`),
    `Verification: ${selection.plan.commands.map((command) => command.key).join(", ") || "select paths once known"}`,
    "During work: npm run verify -- <task-owned paths>; handoff: npm run check -- <task-owned paths>.",
    "Read the following owner sections once; expand only at a dependency or unresolved question.",
  ];
  const included = [];
  let omitted = 0;
  for (const section of sections) {
    const pointer = `${section.path}:${section.start}-${section.end}`;
    const block = `\n${pointer}\n${section.text}`;
    if (Buffer.byteLength([...lines, block].join("\n"), "utf8") <= budget - 150) {
      lines.push(block);
      included.push(section);
    } else {
      const deferred = `Deferred section: ${pointer} (${section.heading ?? "whole document"}); open if needed.`;
      if (Buffer.byteLength([...lines, deferred].join("\n")) <= budget - 150) lines.push(deferred);
      else omitted++;
    }
  }
  if (omitted) lines.push(`${omitted} more section locations omitted; --json returns the complete selection.`);
  return { text: lines.join("\n"), included };
}

export function renderSourceOutline(declarations, symbol = null, budget = CONTEXT_OUTPUT_BYTES) {
  const selected = symbol ? declarations.filter((entry) => entry.name === symbol) : declarations;
  if (symbol && !selected.length) throw new Error(`Symbol not found: ${symbol}`);
  const lines = [];
  const included = [];
  let omitted = 0;
  for (const entry of selected) {
    const pointer = `${entry.name}: ${entry.path}:${entry.start}-${entry.end}`;
    const block = symbol ? `${pointer}\n${entry.text}` : pointer;
    if (Buffer.byteLength([...lines, block].join("\n")) <= budget - 150) {
      lines.push(block);
      if (symbol) included.push(entry);
    } else if (Buffer.byteLength([...lines, pointer].join("\n")) <= budget - 300) {
      lines.push(`${pointer} (declaration exceeds remaining output budget; read a targeted line range)`);
    } else omitted++;
  }
  if (omitted) lines.push(`${omitted} more declarations omitted; use a scoped symbol search in the source file.`);
  return { text: lines.join("\n"), included };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseContextArgs(argv);
    if (options.outline) {
      const declarations = sourceOutline(ROOT, options.outline);
      const rendered = renderSourceOutline(declarations, options.symbol);
      for (const entry of rendered.included) recordAgentEvent(ROOT, readExposure(entry));
      console.log(rendered.text);
      return 0;
    }
    if (!options.task && !options.paths.length && !options.diff) {
      console.log(
        `Usage: npm run context -- <paths> | --task <${Object.keys(CONTEXT_TASKS).join("|")}> | --diff | --outline <file> [--symbol <name>]`,
      );
      return 0;
    }
    const paths = options.diff ? resolveSelectedPaths(ROOT, { paths: [] }) : options.paths;
    const selection = selectContext(paths, options.task);
    const sections = contextSections(ROOT, selection);
    const rendered = renderContext(selection, sections);
    for (const section of options.json ? sections : rendered.included) recordAgentEvent(ROOT, readExposure(section));
    console.log(options.json ? JSON.stringify({ ...selection, sections }, null, 2) : rendered.text);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = main();
