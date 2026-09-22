#!/usr/bin/env node
import path from "node:path";

import { CONTEXT_TASKS, selectContext, contextSections, sourceOutline } from "./lib/agent/agent-context.mjs";
import { resolveSelectedPaths } from "./lib/verification/changed-paths.mjs";
import { recordAgentEvent, readExposure } from "./lib/agent/agent-events.mjs";
import { incrementalContext, relatedLocations } from "./lib/agent/agent-discovery.mjs";
import { compactMarkdownTables, sectionPreview } from "./lib/agent/markdown-sections.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export const CONTEXT_OUTPUT_BYTES = 12_000;

export function parseContextArgs(argv) {
  const options = {
    paths: [],
    task: null,
    outline: null,
    symbol: null,
    diff: false,
    json: false,
    entries: false,
    entry: null,
    tests: false,
    test: null,
    related: false,
    session: null,
    refresh: false,
    full: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (["--task", "--outline", "--symbol", "--entry", "--test", "--session"].includes(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
    } else if (arg === "--diff") options.diff = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--tests") options.tests = true;
    else if (arg === "--entries") options.entries = true;
    else if (arg === "--related") options.related = true;
    else if (arg === "--refresh") options.refresh = true;
    else if (arg === "--full") options.full = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else options.paths.push(arg);
  }
  if (options.diff && options.paths.length) throw new Error("Choose explicit paths or --diff, not both.");
  if (options.symbol && !options.outline) throw new Error("--symbol requires --outline <file>");
  if ((options.entries || options.entry) && !options.outline)
    throw new Error("--entries and --entry require --outline <file>");
  if (options.symbol && (options.entries || options.entry)) throw new Error("Choose --symbol or entry discovery");
  if ((options.tests || options.test) && !options.outline)
    throw new Error("--tests and --test require --outline <file>");
  if ((options.tests || options.test) && (options.symbol || options.entries || options.entry))
    throw new Error("Choose test discovery, --symbol, or entry discovery");
  if (options.refresh && !options.session) throw new Error("--refresh requires --session <id>");
  if (
    options.outline &&
    (options.session || options.related || options.json || options.paths.length || options.task || options.diff)
  )
    throw new Error("Outline mode cannot be combined with documentation discovery options");
  if (options.full && !options.json) throw new Error("--full requires --json");
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
  if (selection.related) {
    lines.push("Related locations (ranked static-import hints, at most two hops; not exhaustive test coverage):");
    for (const [kind, files] of Object.entries(selection.related))
      for (const file of files) lines.push(`  ${kind}: ${file}`);
  }
  for (const pointer of selection.pointers ?? [])
    lines.push(`More guidance (--task ${pointer.task}): ${pointer.path} § ${pointer.heading}`);
  const included = [];
  let omitted = 0;
  for (const section of sections) {
    const pointer = `${section.path}:${section.start}-${section.end}`;
    const block = `\n${pointer}\n${compactMarkdownTables(section.text)}`;
    if (Buffer.byteLength([...lines, block].join("\n"), "utf8") <= budget - 150) {
      lines.push(block);
      included.push(section);
    } else {
      const deferred = `Deferred section: ${pointer} (${section.heading ?? "whole document"}); open if needed.`;
      if (Buffer.byteLength([...lines, deferred].join("\n")) <= budget - 150) lines.push(deferred);
      else omitted++;
      for (const preview of sectionPreview(section)) {
        if (Buffer.byteLength([...lines, preview].join("\n")) <= budget - 150) lines.push(preview);
        else break;
      }
    }
  }
  if (omitted) lines.push(`${omitted} more section locations omitted; use --json --full for the complete selection.`);
  return { text: lines.join("\n"), included };
}

export function renderSourceOutline(declarations, symbol = null, budget = CONTEXT_OUTPUT_BYTES) {
  const selected = symbol ? declarations.filter((entry) => entry.name === symbol) : declarations;
  if (symbol && !selected.length) {
    const error = new Error(`Symbol or entry not found: ${symbol}`);
    error.code = "ENOENT";
    throw error;
  }
  const lines = [];
  const included = [];
  let omitted = 0;
  for (const entry of selected) {
    const pointer = `${entry.name}: ${entry.path}:${entry.start}-${entry.end}`;
    const block = symbol ? `${pointer}\n${entry.text}` : pointer;
    if (Buffer.byteLength([...lines, block].join("\n")) <= budget - 150) {
      lines.push(block);
      if (symbol) {
        included.push(entry);
        if (entry.setup?.length) {
          const setupLines = ["Setup pointers (inspect as needed):", ...entry.setup];
          let shown = 0;
          for (const line of setupLines) {
            if (Buffer.byteLength([...lines, line].join("\n")) > budget - 150) break;
            lines.push(line);
            shown++;
          }
          if (shown < setupLines.length)
            lines.push("More setup pointers omitted; inspect imports and enclosing suite hooks in this file.");
        }
      }
    } else if (Buffer.byteLength([...lines, pointer].join("\n")) <= budget - 300) {
      lines.push(`${pointer} (declaration exceeds remaining output budget; read a targeted line range)`);
    } else omitted++;
  }
  if (omitted) lines.push(`${omitted} more declarations omitted; use a scoped symbol search in the source file.`);
  return { text: lines.join("\n") || "No outline entries found; use a scoped source search.", included };
}

export function main(argv = process.argv.slice(2)) {
  let operation = "context";
  try {
    const options = parseContextArgs(argv);
    if (options.outline) {
      operation = "outline";
      const declarations = sourceOutline(ROOT, options.outline, {
        entries: options.entries || Boolean(options.entry),
        tests: options.tests || Boolean(options.test),
      });
      const rendered = renderSourceOutline(declarations, options.test ?? options.entry ?? options.symbol);
      recordAgentEvent(ROOT, {
        kind: "discovery",
        operation: "outline",
        status: declarations.length ? "found" : "not-found",
        truncated:
          rendered.included.length <
            (options.test || options.entry || options.symbol
              ? declarations.filter((entry) => entry.name === (options.test ?? options.entry ?? options.symbol)).length
              : 0) || rendered.text.includes("omitted"),
      });
      for (const entry of rendered.included) recordAgentEvent(ROOT, readExposure(entry));
      console.log(rendered.text);
      return 0;
    }
    if (!options.task && !options.paths.length && !options.diff) {
      console.log(
        `Usage: npm run context -- <paths> | --task <${Object.keys(CONTEXT_TASKS).join("|")}> | --diff | --outline <file> [--symbol <name> | --entries | --entry <id> | --tests | --test <suite-qualified-name>]\nOptional doc discovery: --related --session <id> [--refresh]`,
      );
      return 0;
    }
    const paths = options.diff ? resolveSelectedPaths(ROOT, { flags: new Set(["diff"]), paths: [] }) : options.paths;
    const selection = selectContext(paths, options.task);
    if (options.related) selection.related = relatedLocations(ROOT, paths.length ? paths : selection.entrypoints);
    const allSections = contextSections(ROOT, selection);
    const incremental = options.session
      ? incrementalContext(ROOT, options.session, allSections, { refresh: options.refresh })
      : null;
    const sections = incremental?.sections ?? allSections;
    const notice = incremental
      ? `Context session ${options.session}: ${incremental.omitted} unchanged sections omitted. Use --refresh after context loss or a new session ID for a fresh agent.`
      : "";
    const rendered = renderContext(selection, sections, CONTEXT_OUTPUT_BYTES - Buffer.byteLength(notice) - 1);
    const included = options.json && options.full ? sections : rendered.included;
    for (const section of included)
      recordAgentEvent(
        ROOT,
        readExposure(options.json ? section : { ...section, text: compactMarkdownTables(section.text) }),
      );
    recordAgentEvent(ROOT, {
      kind: "discovery",
      operation: "context",
      status: "found",
      truncated: included.length < sections.length,
    });
    console.log(
      options.json
        ? JSON.stringify(
            {
              ...selection,
              sections: included,
              deferredSections: sections
                .filter((section) => !included.includes(section))
                .map(({ path, heading, start, end }) => ({ path, heading, start, end })),
              omittedUnchanged: incremental?.omitted ?? 0,
              complete: Boolean(options.full),
            },
            null,
            2,
          )
        : [notice, rendered.text].filter(Boolean).join("\n"),
    );
    incremental?.remember(included);
    return 0;
  } catch (error) {
    try {
      recordAgentEvent(ROOT, {
        kind: "discovery",
        operation,
        status: error.code === "ENOENT" ? "not-found" : "failed",
        truncated: false,
      });
    } catch {}
    console.error(error.message);
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = main();
