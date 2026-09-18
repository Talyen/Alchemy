import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ensureOutputDir,
  getManagedManifestPath,
  readSourceDir,
  resolvePipelinePaths,
  resolveRootDir,
  runManifestPipeline,
} from "../../scripts/lib/asset-pipeline-runner.mjs";

const tempDirs: string[] = [];
afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

async function makeTempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "alchemy-runner-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolvePipelinePaths", () => {
  it("derives matching source, output, and manifest paths per pipeline", () => {
    const url = new URL("file:///repo/scripts/optimize-assets.mjs").href;
    expect(resolvePipelinePaths(url, { sourceSubpath: ["Raw Assets"], managedKey: "art" })).toEqual({
      rootDir: path.resolve("/repo"),
      sourceDir: path.join(path.resolve("/repo"), "Raw Assets"),
      outputDir: path.join(path.resolve("/repo"), "src/assets/optimized"),
      manifestPath: path.join(path.resolve("/repo"), "src/assets/optimized", ".asset-hashes.json"),
    });
    const sounds = resolvePipelinePaths(url, {
      sourceSubpath: ["Raw Assets", "Sound Effects"],
      managedKey: "sounds",
    });
    expect(sounds.outputDir).toBe(path.join(path.resolve("/repo"), "public/sounds"));
    expect(sounds.manifestPath).toBe(getManagedManifestPath(path.resolve("/repo"), "sounds"));
    const music = resolvePipelinePaths(url, { sourceSubpath: ["Raw Assets", "Music"], managedKey: "music" });
    expect(music.outputDir).toBe(path.join(path.resolve("/repo"), "public/Music"));
  });

  it("resolves the repository root from a module URL", () => {
    expect(resolveRootDir(new URL("file:///repo/scripts/optimize-music.mjs").href)).toBe(path.resolve("/repo"));
  });
});

describe("ensureOutputDir", () => {
  it("creates the directory for mutating runs but never in check mode", async () => {
    const dir = await makeTempDir();
    const created = path.join(dir, "nested", "out");
    await ensureOutputDir(created);
    expect((await readdir(path.join(dir, "nested"))).sort()).toEqual(["out"]);
    const untouched = path.join(dir, "check-only");
    await expect(ensureOutputDir(untouched, { check: true })).resolves.toBeUndefined();
    await expect(readdir(untouched)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("readSourceDir", () => {
  it("wraps a missing checkout with its code and path", async () => {
    const dir = await makeTempDir();
    const missing = path.join(dir, "nope");
    const failure = await readSourceDir(missing).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({ code: "ENOENT", path: missing });
    expect((failure as Error).message).toContain("Missing Raw Assets source");
  });

  it("reads entries and rethrows non-missing errors untouched", async () => {
    const dir = await makeTempDir();
    await writeFile(path.join(dir, "a.ogg"), "a");
    expect((await readSourceDir(dir, "custom context")).map((entry) => entry.name)).toEqual(["a.ogg"]);
  });
});

describe("runManifestPipeline", () => {
  it("publishes the manifest and sweeps orphans with the shared manifest name", async () => {
    const dir = await makeTempDir();
    const outputDir = path.join(dir, "out");
    await mkdir(outputDir, { recursive: true });
    const manifestPath = path.join(outputDir, ".asset-hashes.json");
    await writeFile(path.join(outputDir, "stale.txt"), "stale");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runManifestPipeline({
      entries: [{ target: "a.txt" }],
      manifestPath,
      outputDir,
      label: "test file",
      processEntry: async (entry: { target: string }) => {
        await writeFile(path.join(outputDir, entry.target), "a");
        return { message: "wrote", entry: { hash: "h", outputHash: "o" } };
      },
      check: false,
      skipLabel: "test manifest write and orphan sweep",
    });
    expect(result.ok).toBe(true);
    expect(JSON.parse(await readFile(manifestPath, "utf8"))).toEqual({ "a.txt": { hash: "h", outputHash: "o" } });
    await expect(readdir(outputDir).then((names) => names.sort())).resolves.toEqual([".asset-hashes.json", "a.txt"]);
  });

  it("holds publication for commit:false callers and still reports failures", async () => {
    const dir = await makeTempDir();
    const outputDir = path.join(dir, "out");
    await mkdir(outputDir, { recursive: true });
    const manifestPath = path.join(outputDir, ".asset-hashes.json");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await runManifestPipeline({
      entries: [{ target: "bad.txt" }, { target: "good.txt" }],
      manifestPath,
      outputDir,
      label: "test file",
      processEntry: async (entry: { target: string }) => {
        if (entry.target === "bad.txt") throw new Error("boom");
        return { message: "ok", entry: { hash: "h" } };
      },
      check: false,
      skipLabel: "later manifest write",
      commit: false,
    });
    expect(result.ok).toBe(false);
    expect(result.previousManifest).toEqual({});
    expect(result.nextManifest).toEqual({ "good.txt": { hash: "h" } });
    await expect(readdir(outputDir).then((names) => names.sort())).resolves.toEqual([]);
  });
});
