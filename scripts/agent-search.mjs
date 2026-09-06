#!/usr/bin/env node
import path from "node:path";
import { repositorySearch } from "./lib/agent-discovery.mjs";
import { readExposure, recordAgentEvent } from "./lib/agent-events.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

export function searchMain(argv = process.argv.slice(2), root = ROOT) {
  try {
    const options = { excerpts: false, includeExcluded: false, regex: false, paths: [], pattern: undefined };
    let positional = false;
    for (const arg of argv) {
      if (!positional && arg === "--") positional = true;
      else if (!positional && arg === "--excerpts") options.excerpts = true;
      else if (!positional && arg === "--include-excluded") options.includeExcluded = true;
      else if (!positional && arg === "--regex") options.regex = true;
      else if (!positional && arg.startsWith("--")) throw new Error(`Unknown search option: ${arg}`);
      else if (options.pattern === undefined) options.pattern = arg;
      else options.paths.push(arg);
    }
    if (!options.pattern)
      throw new Error("Usage: npm run search -- [--excerpts] [--regex] [--include-excluded] <pattern> [paths...]");
    if (options.includeExcluded && !options.paths.length)
      throw new Error("--include-excluded requires an explicit path");
    if (!options.paths.length) options.paths.push(".");
    const results = repositorySearch(root, options);
    const lines = [];
    let included = 0;
    let clipped = false;
    for (const result of results) {
      let line = typeof result === "string" ? result : `${result.path}:${result.start}: ${result.text}`;
      const oversized = typeof result !== "string" && Buffer.byteLength(line) > 2_000;
      if (oversized) {
        line = `${result.path}:${result.start}: [long line omitted; inspect this location directly]`;
        clipped = true;
      }
      if (included >= 40 || Buffer.byteLength([...lines, line].join("\n")) > 7_500) break;
      lines.push(line);
      included++;
      if (typeof result !== "string" && !oversized) recordAgentEvent(root, readExposure(result));
    }
    const truncated = clipped || included < results.length;
    lines.push(
      `${results.length} matches; ${included} shown.${truncated ? " Narrow the path or pattern for omitted matches." : ""}`,
    );
    recordAgentEvent(root, {
      kind: "discovery",
      operation: "search",
      status: results.length ? "found" : "not-found",
      truncated,
    });
    console.log(lines.join("\n"));
    return results.length ? 0 : 1;
  } catch (error) {
    try {
      recordAgentEvent(root, { kind: "discovery", operation: "search", status: "failed", truncated: false });
    } catch {}
    console.error(error.message);
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = searchMain();
