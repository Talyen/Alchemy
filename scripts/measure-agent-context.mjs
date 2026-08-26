#!/usr/bin/env node
/** Measure a stable byte proxy for route-selected agent prereads and named evidence. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTES, resolveRoutePlan } from "./lib/change-routes.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INSTRUCTION_FILES = ["AGENTS.md"];

export const ROUTE_CONTEXT_BUDGETS = Object.freeze({
  "active-run": { preread: 13 * 1024, total: 16 * 1024 },
  save: { preread: 12 * 1024, total: 23 * 1024 },
  battle: { preread: 13 * 1024, total: 15 * 1024 },
  "content-systems": { preread: 9 * 1024, total: 16 * 1024 },
  homestead: { preread: 10 * 1024, total: 11 * 1024 },
  generated: { preread: 9 * 1024, total: 35 * 1024 },
  balance: { preread: 10 * 1024, total: 31 * 1024 },
  shop: { preread: 10 * 1024, total: 11 * 1024 },
  "shop-screen": { preread: 10 * 1024, total: 17 * 1024 },
  audio: { preread: 9 * 1024, total: 13 * 1024 },
  routing: { preread: 12 * 1024, total: 24 * 1024 },
  gear: { preread: 12 * 1024, total: 22 * 1024 },
  mystery: { preread: 11 * 1024, total: 22 * 1024 },
  integration: { preread: 13 * 1024, total: 24 * 1024 },
  "unit-test": { preread: 9 * 1024, total: 23 * 1024 },
  "e2e-helper": { preread: 13 * 1024, total: 17 * 1024 },
  "root-specs": { preread: 10 * 1024, total: 10 * 1024 },
  tooling: { preread: 9 * 1024, total: 18 * 1024 },
  assets: { preread: 14 * 1024, total: 18 * 1024 },
  "ci-routing": { preread: 9 * 1024, total: 28 * 1024 },
  documentation: { preread: 10 * 1024, total: 58 * 1024 },
  "ui-flow": { preread: 13 * 1024, total: 22 * 1024 },
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

function sectionSource(relativePath, heading) {
  const source = fs.readFileSync(absolutePath(relativePath), "utf8");
  if (!heading) return source;
  const lines = source.split(/\r?\n/u);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const headingPattern = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`, "u");
  let level = 0;
  const start = lines.findIndex((line) => {
    const match = headingPattern.exec(line.trim());
    if (!match) return false;
    level = match[1].length;
    return true;
  });
  if (start < 0) throw new Error(`Context heading is missing: ${relativePath} -> ${heading}`);
  const end = lines.findIndex((line, index) => {
    if (index <= start) return false;
    const match = /^(#{1,6})\s+/u.exec(line.trim());
    return Boolean(match && match[1].length <= level);
  });
  return lines.slice(start, end < 0 ? lines.length : end).join("\n");
}

function measureDocument({ path: relativePath, heading = null, reason = "explicit document" }, kind) {
  if (!fs.existsSync(absolutePath(relativePath))) throw new Error(`Context file is missing: ${relativePath}`);
  return {
    path: relativePath,
    heading,
    reason,
    kind,
    bytes: Buffer.byteLength(sectionSource(relativePath, heading), "utf8"),
  };
}

function uniqueDocuments(routes) {
  const selected = new Map();
  for (const route of routes) {
    for (const entry of route.docs ?? []) {
      const key = `${entry.path}#${entry.heading ?? ""}`;
      if (!selected.has(key)) selected.set(key, entry);
    }
  }
  return [...selected.values()];
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
  const ownerDocs = (explicitDocs ?? uniqueDocuments(routes)).map((entry) => measureDocument(entry, "owner"));
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
