#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { measureStorage } from "./lib/storage-footprint.mjs";
import { formatBytes } from "./lib/clean-dev-artifacts.mjs";
import { REPO_ROOT } from "./lib/repository-paths.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";

function main(argv = process.argv.slice(2)) {
  const { flags, values, rest } = parseKnownFlags(argv, { json: { takesValue: true }, help: { short: "h" } });
  if (rest.length) throw new UsageError(`Unexpected storage arguments: ${rest.join(", ")}`);
  if (flags.has("help")) {
    console.log(
      "Usage: npm run storage:report -- [--json reports/storage/baseline.json]\nRead-only logical file sizes. Known shared roots are resolved; nested symlinks are ignored. Existing outputs are measured without rebuilding. Categories overlap; do not sum them.",
    );
    return;
  }
  const areas = [
    ".git",
    ".worktrees",
    "node_modules",
    "assets/sources",
    "src/assets",
    "public",
    "reports",
    ".cache",
    "scripts/trailers/node_modules",
    "dist",
    "dist-demo",
    "release-desktop",
    "release-desktop-demo",
  ];
  const report = {
    version: 1,
    measuredAt: new Date().toISOString(),
    root: REPO_ROOT,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim(),
    units: "logical bytes; shared roots resolved; nested symlinks excluded; areas overlap",
    areas: {},
  };
  for (const area of areas) {
    let absolute = path.join(REPO_ROOT, area);
    if (!fs.existsSync(absolute)) continue;
    absolute =
      area === ".git"
        ? execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
            cwd: REPO_ROOT,
            encoding: "utf8",
          }).trim()
        : fs.realpathSync(absolute);
    report.areas[area] = measureStorage(absolute);
    const sizes = report.areas[area];
    console.log(`[storage] ${area}: ${formatBytes(sizes.bytes)} (${sizes.files} files)`);
    if (area.startsWith("release-desktop")) {
      for (const [child, bytes] of Object.entries(sizes.children)) console.log(`  ${child}: ${formatBytes(bytes)}`);
    }
  }
  if (values.has("json")) {
    const destination = path.resolve(REPO_ROOT, values.get("json").at(-1));
    if (!destination.startsWith(path.join(REPO_ROOT, "reports") + path.sep))
      throw new UsageError("Storage JSON must be written inside reports/");
    let ancestor = REPO_ROOT;
    for (const segment of path.relative(REPO_ROOT, destination).split(path.sep)) {
      ancestor = path.join(ancestor, segment);
      if (fs.lstatSync(ancestor, { throwIfNoEntry: false })?.isSymbolicLink())
        throw new UsageError("Storage JSON must not traverse symlinks");
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n");
    console.log(`[storage] Saved ${path.relative(REPO_ROOT, destination)}`);
  }
}

defineScript(import.meta.url, () => main());
