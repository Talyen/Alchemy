#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { isMainModule } from "./lib/is-main-module.mjs";
import { resolveRootDir } from "./lib/sync-generated-helpers.mjs";
import { prepareAssets } from "./prepare-assets.mjs";

const rootDir = resolveRootDir(import.meta.url);

const PREPARED_ASSET_OUTPUTS = Object.freeze([
  "src/assets/optimized",
  "public/sounds",
  "public/Music",
  "src/lib/game-data/assets.generated.ts",
  "src/lib/game-data/gear-art.ts",
]);

/** @typedef {Map<string, Buffer>} AssetSnapshot */
/** @typedef {Map<string, string>} HashSnapshot */

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

async function hashSnapshot(snapshot) {
  const hashes = new Map();
  for (const [relativePath, bytes] of snapshot) {
    hashes.set(relativePath, createHash("sha256").update(bytes).digest("hex"));
  }
  return hashes;
}

function snapshotDigestFromHashes(hashes) {
  return JSON.stringify([...hashes.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function changedPathsFromHashes(beforeHashes, afterHashes) {
  const paths = new Set([...beforeHashes.keys(), ...afterHashes.keys()]);
  return [...paths].filter((relativePath) => beforeHashes.get(relativePath) !== afterHashes.get(relativePath)).sort();
}

async function restoreSnapshot(before, afterHashes) {
  for (const [relativePath, bytes] of before) {
    const absolutePath = path.join(rootDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
  }
  for (const relativePath of afterHashes.keys()) {
    if (!before.has(relativePath)) await unlink(path.join(rootDir, relativePath));
  }
}

/** Verify preparation is idempotent without leaving a mutated tree on failure. */
export async function checkPreparedAssets() {
  if (process.env.ALCHEMY_SKIP_ASSETS === "1") {
    throw new Error("assets:check cannot run with ALCHEMY_SKIP_ASSETS=1.");
  }
  const before = await outputSnapshot();
  const beforeHashes = await hashSnapshot(before);
  const beforeDigest = snapshotDigestFromHashes(beforeHashes);
  let prepareError;
  let afterHashes = null;
  let afterDigest = null;
  try {
    await prepareAssets();
    const after = await outputSnapshot();
    afterHashes = await hashSnapshot(after);
    afterDigest = snapshotDigestFromHashes(afterHashes);
    if (beforeDigest !== afterDigest) {
      const changed = changedPathsFromHashes(beforeHashes, afterHashes);
      throw new Error(`Prepared asset outputs are stale. Review and regenerate:\n- ${changed.join("\n- ")}`);
    }
    console.log("Prepared asset outputs are current.");
  } catch (error) {
    prepareError = error;
  }
  const needsRestore =
    prepareError !== undefined || (afterDigest !== null && afterHashes !== null && beforeDigest !== afterDigest);
  if (needsRestore) {
    try {
      const restoreAfterHashes = afterHashes ?? (await hashSnapshot(await outputSnapshot()));
      await restoreSnapshot(before, restoreAfterHashes);
    } catch (restoreError) {
      console.error(
        "Failed to restore prepared outputs:",
        restoreError instanceof Error ? restoreError.message : restoreError,
      );
      if (!prepareError) throw restoreError;
    }
  }
  if (prepareError) throw prepareError;
}

if (isMainModule(import.meta.url)) {
  checkPreparedAssets().catch((error) => {
    console.error("Prepared asset check failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
