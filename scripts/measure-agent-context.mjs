#!/usr/bin/env node
/** Measure a stable byte proxy for route-selected agent prereads and named evidence. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTES, resolveRoutePlan } from "./lib/change-routes.mjs";
import { readDocumentSection } from "./lib/document-sections.mjs";
import { selectContext, contextSections } from "./lib/agent-context.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INSTRUCTION_FILES = ["AGENTS.md"];

export const ROUTE_CONTEXT_BUDGETS = Object.freeze({
  save: { preread: 12 * 1024, total: 24 * 1024 },
  balance: { preread: 10 * 1024, total: 31 * 1024 },
  performance: { preread: 22 * 1024, total: 35 * 1024 },
  desktop: { preread: 11 * 1024, total: 15 * 1024 },
  "unit-test": { preread: 9 * 1024, total: 23 * 1024 },
  tooling: { preread: 9 * 1024, total: 18 * 1024 },
  assets: { preread: 17 * 1024, total: 25 * 1024 },
  documentation: { preread: 11 * 1024, total: 60 * 1024 },
  runtime: { preread: 30 * 1024, total: 45 * 1024 },
  "browser-test": { preread: 14 * 1024, total: 24 * 1024 },
  unknown: { preread: 9 * 1024, total: 9 * 1024 },
});

function parseArgs(argv) {
  const paths = [];
  const docs = [];
  const artifacts = [];
  const outputFiles = [];
  let allRoutes = false;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--path") paths.push(argv[++index]);
    else if (arg === "--doc") docs.push(argv[++index]);
    else if (arg === "--artifact") artifacts.push(argv[++index]);
    else if (arg === "--output-file") outputFiles.push(argv[++index]);
    else if (arg === "--all-routes") allRoutes = true;
    else if (arg === "--json") json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (allRoutes && (paths.length > 0 || docs.length > 0 || artifacts.length > 0 || outputFiles.length > 0)) {
    throw new Error("--all-routes cannot be combined with path, document, artifact, or output selections");
  }
  return {
    paths: paths.filter(Boolean),
    docs: docs.filter(Boolean),
    artifacts: artifacts.filter(Boolean),
    outputFiles: outputFiles.filter(Boolean),
    allRoutes,
    json,
  };
}

function absolutePath(relativePath) {
  return path.resolve(ROOT, relativePath);
}

function fileBytes(relativePath) {
  try {
    const stats = fs.statSync(absolutePath(relativePath));
    return stats.isFile() ? stats.size : 0;
  } catch {
    return 0;
  }
}

function measureDocument({ path: relativePath, heading = null, reason = "explicit document" }, kind) {
  if (!fs.existsSync(absolutePath(relativePath))) throw new Error(`Context file is missing: ${relativePath}`);
  return {
    path: relativePath,
    heading,
    reason,
    kind,
    bytes: Buffer.byteLength(readDocumentSection(ROOT, relativePath, heading).text, "utf8"),
  };
}

function countTestFiles(plan) {
  return new Set(plan.commands.flatMap((command) => command.args.filter((arg) => /^tests\//u.test(arg)))).size;
}

export function measureContext(options = {}) {
  const paths = options.paths?.length ? options.paths : ["docs/REFERENCE.md"];
  const plan = resolveRoutePlan(paths);
  const routes = options.routes ?? plan.routes;
  const instructions = INSTRUCTION_FILES.map((filePath) =>
    measureDocument({ path: filePath, reason: "always-loaded repository instructions" }, "instruction"),
  );
  const explicitDocs = options.docs?.length ? options.docs.map((filePath) => ({ path: filePath })) : null;
  const selectedDocs = contextSections(ROOT, selectContext(paths));
  const ownerDocs = (explicitDocs ?? selectedDocs).map((entry) => measureDocument(entry, "owner"));
  const artifacts = (options.artifacts ?? []).map((filePath) => ({ path: filePath, bytes: fileBytes(filePath) }));
  const outputs = (options.outputFiles ?? []).map((filePath) => ({ path: filePath, bytes: fileBytes(filePath) }));
  const instructionBytes = instructions.reduce((total, entry) => total + entry.bytes, 0);
  const ownerDocBytes = ownerDocs.reduce((total, entry) => total + entry.bytes, 0);
  const changedFileBytes = paths.reduce((total, filePath) => total + fileBytes(filePath), 0);
  return {
    changedPaths: paths,
    routes: routes.map((route) => route.id),
    instructions,
    ownerDocs,
    docs: [...instructions, ...ownerDocs],
    instructionBytes,
    ownerDocBytes,
    selectedBytes: instructionBytes + ownerDocBytes,
    changedFileBytes,
    totalContextBytes: instructionBytes + ownerDocBytes + changedFileBytes,
    verificationCommands: plan.commands.length,
    deduplicatedTestPaths: countTestFiles(plan),
    artifacts,
    artifactBytes: artifacts.reduce((total, entry) => total + entry.bytes, 0),
    outputs,
    namedOutputBytes: outputs.reduce((total, entry) => total + entry.bytes, 0),
  };
}

export function measureAllRoutes() {
  const rows = ROUTES.map((route) => measureContext({ paths: [route.fixture], routes: [route] }));
  rows.push(measureContext({ paths: ["unknown.file"] }));
  return rows.sort((a, b) => b.totalContextBytes - a.totalContextBytes);
}

function formatDocument(entry) {
  const section = entry.heading ? ` § ${entry.heading}` : "";
  return `  ${entry.path}${section}: ${entry.bytes.toLocaleString()} bytes — ${entry.reason}`;
}

function formatMeasurement(measurement) {
  return [
    `Selected preread proxy: ${measurement.selectedBytes.toLocaleString()} bytes`,
    `Changed files: ${measurement.changedFileBytes.toLocaleString()} bytes`,
    `Total context proxy: ${measurement.totalContextBytes.toLocaleString()} bytes`,
    `Routes: ${measurement.routes.join(", ")}`,
    `Instructions: ${measurement.instructionBytes.toLocaleString()} bytes`,
    ...measurement.instructions.map(formatDocument),
    `Owner docs: ${measurement.ownerDocBytes.toLocaleString()} bytes`,
    ...(measurement.ownerDocs.length > 0 ? measurement.ownerDocs.map(formatDocument) : ["  none selected"]),
    `Verification commands: ${measurement.verificationCommands}; deduplicated test paths: ${measurement.deduplicatedTestPaths}`,
    ...(measurement.artifactBytes > 0 ? [`Named artifacts: ${measurement.artifactBytes.toLocaleString()} bytes`] : []),
    ...(measurement.namedOutputBytes > 0
      ? [`Named command output: ${measurement.namedOutputBytes.toLocaleString()} bytes`]
      : []),
  ].join("\n");
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const result = args.allRoutes ? measureAllRoutes() : measureContext(args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else if (Array.isArray(result)) {
      console.log("Route context proxy (largest first):");
      for (const row of result) {
        console.log(
          `${row.routes.join("+")}: ${row.totalContextBytes.toLocaleString()} bytes ` +
            `(preread ${row.selectedBytes.toLocaleString()}; fixture ${row.changedFileBytes.toLocaleString()})`,
        );
      }
    } else console.log(formatMeasurement(result));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = main();
