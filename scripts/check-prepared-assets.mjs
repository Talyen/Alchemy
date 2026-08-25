#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isMainModule } from "./lib/is-main-module.mjs";
import { prepareAssets } from "./prepare-assets.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PREPARED_ASSET_OUTPUTS = Object.freeze([
  "src/assets/optimized",
  "public/sounds",
  "public/Music",
  "src/lib/game-data/assets.generated.ts",
  "src/lib/game-data/gear-art.ts",
]);

/** @typedef {Map<string, Buffer>} AssetSnapshot */

async function snapshotPath(relativePath, snapshot) {
  const absolutePath = path.join(rootDir, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOTDIR") return null;
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  });
  if (entries === null) {
    snapshot.set(relativePath, await readFile(absolutePath));
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) await snapshotPath(path.join(relativePath, entry.name), snapshot);
    else if (entry.isFile()) await snapshotPath(path.join(relativePath, entry.name), snapshot);
  }
}

async function outputSnapshot() {
  /** @type {AssetSnapshot} */
  const snapshot = new Map();
  for (const relativePath of PREPARED_ASSET_OUTPUTS) await snapshotPath(relativePath, snapshot);
  return snapshot;
}

function snapshotDigest(snapshot) {
  return JSON.stringify(
    [...snapshot.entries()]
      .map(([relativePath, bytes]) => [relativePath, createHash("sha256").update(bytes).digest("hex")])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function changedPaths(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths]
    .filter((relativePath) => {
      const previous = before.get(relativePath);
      const next = after.get(relativePath);
      return !previous || !next || !previous.equals(next);
    })
    .sort();
}

async function restoreSnapshot(before, after) {
  for (const [relativePath, bytes] of before) {
    const absolutePath = path.join(rootDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
  }
  for (const relativePath of after.keys()) {
    if (!before.has(relativePath)) await unlink(path.join(rootDir, relativePath));
  }
}

/** Verify preparation is idempotent without leaving a mutated tree on failure. */
async function checkPreparedAssets() {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    throw new Error("assets:check cannot run with ALCHEMY_SKIP_ASSETS=1.");
  }
  const before = await outputSnapshot();
  await prepareAssets();
  const after = await outputSnapshot();
  if (snapshotDigest(before) !== snapshotDigest(after)) {
    const changed = changedPaths(before, after);
    await restoreSnapshot(before, after);
    throw new Error(`Prepared asset outputs are stale. Review and regenerate:\n- ${changed.join("\n- ")}`);
  }
  console.log("Prepared asset outputs are current.");
}

if (isMainModule(import.meta.url)) {
  checkPreparedAssets().catch((error) => {
    console.error("Prepared asset check failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
