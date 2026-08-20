#!/usr/bin/env node
/**
 * Report stable proxy measurements for agent context walkthroughs.
 * This deliberately measures files, routes, and explicitly named artifacts;
 * it does not invent a token quota or enumerate reports/raw assets by default.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePlan } from "./verify-changed.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DOCS = ["AGENTS.md"];
const SECTION_BY_ROUTE = Object.freeze({
  "active-run": { "docs/ARCHITECTURE.md": "Run state" },
  routing: { "docs/ARCHITECTURE.md": "Controller entry points" },
  integration: { "docs/ARCHITECTURE.md": "Run state" },
  battle: { "docs/REFERENCE.md": "Battle Implementation Rules" },
  balance: { "docs/REFERENCE.md": "Balance simulation" },
  save: {
    "docs/WORKFLOWS.md": "Change persisted save data",
    "src/features/alchemy/shared/storage/MIGRATIONS.md": "Public save contract",
  },
  mystery: { "docs/WORKFLOWS.md": "Adding a new mystery effect kind" },
  shop: { "docs/WORKFLOWS.md": "Change a shop" },
  "shop-screen": { "docs/WORKFLOWS.md": "Change a shop" },
  "ui-flow": { "docs/WORKFLOWS.md": "Adding a new screen" },
  gear: {
    "docs/WORKFLOWS.md": "Add permanent Gear",
    "docs/ARMORY.md": "Layout",
  },
  documentation: { "docs/Plans/README.md": null },
});

function docsForRoutes(routeIds, paths) {
  const docs = new Set(DEFAULT_DOCS);
  if (routeIds.some((id) => ["active-run", "routing", "integration"].includes(id))) docs.add("docs/ARCHITECTURE.md");
  if (routeIds.some((id) => ["battle", "balance", "audio"].includes(id))) docs.add("docs/REFERENCE.md");
  if (routeIds.some((id) => ["save", "mystery"].includes(id))) {
    docs.add("docs/WORKFLOWS.md");
    docs.add("src/features/alchemy/shared/storage/MIGRATIONS.md");
  }
  if (routeIds.some((id) => ["shop", "shop-screen", "ui-flow", "gear"].includes(id))) docs.add("docs/WORKFLOWS.md");
  if (routeIds.includes("gear")) docs.add("docs/ARMORY.md");
  if (routeIds.includes("fallback")) docs.add("docs/REFERENCE.md");
  if (routeIds.includes("documentation")) docs.add("docs/Plans/README.md");
  if (
    paths.some((filePath) =>
      /^(?:Raw Assets|public\/(?:Music|sounds)|scripts\/assets|src\/assets\/optimized)/u.test(filePath),
    )
  ) {
    docs.add("docs/WORKFLOWS-ASSETS.md");
  }
  return [...docs];
}

function parseArgs(argv) {
  const paths = [];
  const docs = [];
  const artifacts = [];
  let json = false;
  let outputFiles = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--path") paths.push(argv[++index]);
    else if (arg === "--doc") docs.push(argv[++index]);
    else if (arg === "--artifact") artifacts.push(argv[++index]);
    else if (arg === "--output-file") outputFiles.push(argv[++index]);
    else if (arg === "--json") json = true;
  }
  return {
    paths: paths.filter(Boolean),
    docs: docs.filter(Boolean),
    artifacts: artifacts.filter(Boolean),
    outputFiles: outputFiles.filter(Boolean),
    json,
  };
}

function fileBytes(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);
  try {
    return fs.statSync(absolutePath).size;
  } catch {
    return 0;
  }
}

function sectionBytes(relativePath, heading) {
  if (!heading) return fileBytes(relativePath);
  const absolutePath = path.resolve(ROOT, relativePath);
  try {
    const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/u);
    const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
    if (start < 0) return fileBytes(relativePath);
    const end = lines.findIndex((line, index) => index > start && /^## /u.test(line));
    return lines.slice(start, end < 0 ? lines.length : end).join("\n").length;
  } catch {
    return 0;
  }
}

function sectionsForRoutes(routeIds) {
  const sections = new Map();
  for (const routeId of routeIds) {
    for (const [filePath, heading] of Object.entries(SECTION_BY_ROUTE[routeId] ?? {})) {
      if (!sections.has(filePath) || sections.get(filePath) === null) sections.set(filePath, heading);
    }
  }
  return sections;
}

function countTestFiles(plan) {
  return new Set(plan.commands.flatMap((command) => command.args.filter((arg) => /^tests\//u.test(arg)))).size;
}

export function measureContext(options = {}) {
  const paths = options.paths?.length ? options.paths : ["docs/REFERENCE.md"];
  const plan = resolvePlan(paths);
  const docs = options.docs?.length
    ? options.docs
    : docsForRoutes(
        plan.routes.map((route) => route.id),
        paths,
      );
  const routeSections = sectionsForRoutes(plan.routes.map((route) => route.id));
  const artifactPaths = options.artifacts ?? [];
  const outputFiles = options.outputFiles ?? [];
  const measuredDocs = docs.map((filePath) => {
    const section = options.docs?.length ? null : (routeSections.get(filePath) ?? null);
    return { path: filePath, section, bytes: sectionBytes(filePath, section) };
  });
  return {
    docs: measuredDocs,
    contextBytes: measuredDocs.reduce((total, doc) => total + doc.bytes, 0),
    changedPaths: paths,
    routes: plan.routes.map((route) => route.id),
    verificationCommands: plan.commands.length,
    deduplicatedTestPaths: countTestFiles(plan),
    artifacts: artifactPaths.map((filePath) => ({ path: filePath, bytes: fileBytes(filePath) })),
    outputChars: outputFiles.reduce((total, filePath) => total + fileBytes(filePath), 0),
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const measurement = measureContext(args);
  if (args.json) {
    console.log(JSON.stringify(measurement, null, 2));
    return;
  }
  console.log(
    `Context surface: ${measurement.contextBytes.toLocaleString()} bytes across ${measurement.docs.length} docs`,
  );
  console.log(`Routes: ${measurement.routes.join(", ")}`);
  console.log(
    `Verification commands: ${measurement.verificationCommands}; deduplicated test paths: ${measurement.deduplicatedTestPaths}`,
  );
  if (measurement.artifacts.length > 0)
    console.log(
      `Named artifacts: ${measurement.artifacts.reduce((total, artifact) => total + artifact.bytes, 0).toLocaleString()} bytes`,
    );
  if (measurement.outputChars > 0)
    console.log(`Named command output: ${measurement.outputChars.toLocaleString()} chars`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
