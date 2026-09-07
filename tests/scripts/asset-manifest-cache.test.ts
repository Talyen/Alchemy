import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, utimes, writeFile } from "node:fs/promises";
import { createReadStream, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeContentHash,
  computeOutputHash,
  isOutputFresh,
  loadManifest,
  processManifestEntries,
  resolveSourceHash,
  removeOrphanOutputs,
  withOutputHash,
  writeManifestIfChanged,
} from "../../scripts/lib/asset-manifest-cache.mjs";
import type { ManifestEntry } from "../../scripts/lib/asset-manifest-cache.mjs";
import { mapPool } from "../../scripts/lib/map-pool.mjs";
import { writeTextIfChanged } from "../../scripts/lib/write-text-if-changed.mjs";
import { kebabToCamel } from "../../scripts/lib/kebab-to-camel.mjs";
import {
  GEAR_PREFIX,
  WEBP_SUFFIX,
  getAssetFiles,
  getGearFiles,
  isGearAsset,
  isWebpAsset,
} from "../../scripts/lib/sync-generated-helpers.mjs";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, readFile: vi.fn(original.readFile), readdir: vi.fn(original.readdir) };
});
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return { ...original, createReadStream: vi.fn(original.createReadStream) };
});

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function makeTempDir(prefix = "alchemy-asset-cache-") {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("asset-manifest-cache", () => {
  it("computes a stable content hash for source + settings + schema", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "a.png");
    await writeFile(sourcePath, "bytes-a");

    const hash1 = await computeContentHash(sourcePath, { quality: 80 }, 2);
    const hash2 = await computeContentHash(sourcePath, { quality: 80 }, 2);
    const hashDifferentSettings = await computeContentHash(sourcePath, { quality: 90 }, 2);
    const hashDifferentSchema = await computeContentHash(sourcePath, { quality: 80 }, 3);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashDifferentSettings);
    expect(hash1).not.toBe(hashDifferentSchema);
  });

  it("preserves digest compatibility across streamed chunks and canonical settings", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "large");
    const bytes = Buffer.alloc(256 * 1024, 171);
    await writeFile(sourcePath, bytes);
    const expected = createHash("sha256")
      .update('4\0{"a":[2,1],"z":{"a":1,"b":2}}\0')
      .update(bytes)
      .digest("hex")
      .slice(0, 32);
    expect(await computeContentHash(sourcePath, { z: { b: 2, a: 1 }, a: [2, 1] }, 4)).toBe(expected);
    expect(await computeOutputHash(sourcePath)).toBe(createHash("sha256").update(bytes).digest("hex").slice(0, 32));
  });

  it("detects changed bytes with identical size and timestamp", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "a.png");
    await writeFile(sourcePath, "bytes-a");

    const fixed = new Date("2020-01-01T00:00:00Z");
    await utimes(sourcePath, fixed, fixed);
    const first = await resolveSourceHash(sourcePath, { quality: 80 }, 2);
    await writeFile(sourcePath, "bytes-b");
    await utimes(sourcePath, fixed, fixed);
    const second = await resolveSourceHash(sourcePath, { quality: 80 }, 2);

    expect(second.hash).not.toBe(first.hash);
  });

  it("re-hashes when transform settings change even if source mtime is unchanged", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "a.png");
    await writeFile(sourcePath, "bytes-a");
    const first = await resolveSourceHash(sourcePath, { quality: 80 }, 2);
    const second = await resolveSourceHash(sourcePath, { quality: 90 }, 2);

    expect(second.hash).not.toBe(first.hash);
  });

  it("re-hashes changed content", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "a.png");
    await writeFile(sourcePath, "bytes-a");
    const first = await resolveSourceHash(sourcePath, { quality: 80 }, 2);

    await writeFile(sourcePath, "bytes-a-changed");
    const second = await resolveSourceHash(sourcePath, { quality: 80 }, 2);

    expect(second.hash).not.toBe(first.hash);
  });

  it("loads legacy string hashes without an output digest", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, ".asset-hashes.json");
    await writeFile(manifestPath, `${JSON.stringify({ "a.webp": "abc123" }, null, 2)}\n`);

    const loaded = await loadManifest(manifestPath);
    expect(loaded["a.webp"]?.hash).toBe("abc123");
    expect(loaded["a.webp"]).toEqual({ hash: "abc123" });
  });

  it("round-trips object manifest entries and skips unchanged writes", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, ".asset-hashes.json");
    const entries = {
      "a.webp": { hash: "abc" },
      "b.webp": { hash: "def" },
    };

    expect(await writeManifestIfChanged(manifestPath, entries)).toBe(true);
    expect(await writeManifestIfChanged(manifestPath, entries)).toBe(false);

    const loaded = await loadManifest(manifestPath);
    expect(loaded).toEqual(entries);
  });

  it("normalizes old metadata while preserving hashes and ownership", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, ".asset-hashes.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        "a.ogg": { hash: "abc", outputHash: "out", owner: "curated", mtimeMs: 1, size: 2, settingsSig: "old" },
      }),
    );
    const entries = await loadManifest(manifestPath);
    expect(entries).toEqual({ "a.ogg": { hash: "abc", outputHash: "out", owner: "curated" } });
    expect(await writeManifestIfChanged(manifestPath, entries)).toBe(true);
    expect(await writeManifestIfChanged(manifestPath, entries)).toBe(false);
  });

  it("reports output freshness from hash + existence", async () => {
    const dir = await makeTempDir();
    const outputPath = path.join(dir, "out.webp");
    await writeFile(outputPath, "out");

    const outputHash = await computeOutputHash(outputPath);
    const entry = { hash: "abc", outputHash };
    expect(await isOutputFresh(outputPath, entry, "abc")).toBe(true);
    expect(await isOutputFresh(outputPath, entry, "zzz")).toBe(false);
    expect(await isOutputFresh(path.join(dir, "missing.webp"), entry, "abc")).toBe(false);
  });

  it("rejects a changed output even when its source fingerprint still matches", async () => {
    const dir = await makeTempDir();
    const outputPath = path.join(dir, "out.webp");
    await writeFile(outputPath, "expected-output");
    const entry = await withOutputHash({ hash: "source" }, outputPath);

    await writeFile(outputPath, "tampered-output");

    expect(await isOutputFresh(outputPath, entry, "source")).toBe(false);
  });

  it("treats legacy entries without an output digest as stale", async () => {
    const dir = await makeTempDir();
    const outputPath = path.join(dir, "out.webp");
    await writeFile(outputPath, "output");

    expect(await isOutputFresh(outputPath, { hash: "source" }, "source")).toBe(false);
  });

  it("processes entries without persisting and normalizes failures", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, ".asset-hashes.json");

    const result = await processManifestEntries({
      entries: [{ target: "ok.webp" }, { target: "bad.webp" }],
      manifestPath,
      processEntry: async ({ target }): Promise<{ entry: ManifestEntry | null; message: string }> => {
        if (target === "bad.webp") throw new Error("broken transform");
        return { entry: { hash: "ok" }, message: "ok" };
      },
      handleError: (_entry, error) => ({
        entry: null,
        message: error instanceof Error ? error.message : String(error),
      }),
    });

    expect(result.failed).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.nextManifest).toEqual({ "ok.webp": { hash: "ok" } });
    expect(await loadManifest(manifestPath)).toEqual({});
  });

  it("does not dirty the manifest when only source timestamps change", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "source");
    const manifestPath = path.join(dir, ".asset-hashes.json");
    await writeFile(sourcePath, "same bytes");
    const process = () =>
      processManifestEntries({
        entries: ["a.webp"],
        manifestPath,
        processEntry: async () => ({ entry: await resolveSourceHash(sourcePath, {}, 2) }),
      });
    await writeManifestIfChanged(manifestPath, (await process()).nextManifest);
    await utimes(sourcePath, 1, 1);
    expect(await writeManifestIfChanged(manifestPath, (await process()).nextManifest)).toBe(false);
  });

  it("recovers missing and malformed manifests", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, "manifest");
    expect(await loadManifest(manifestPath)).toEqual({});
    await writeFile(manifestPath, "{broken");
    expect(await loadManifest(manifestPath)).toEqual({});
  });

  it("reports invalid manifest, output, and cleanup path types", async () => {
    const dir = await makeTempDir();
    const file = path.join(dir, "file");
    await writeFile(file, "bytes");
    await expect(loadManifest(dir)).rejects.toMatchObject({ code: "EISDIR" });
    await expect(isOutputFresh(dir, { hash: "a", outputHash: "b" }, "a")).rejects.toMatchObject({ code: "EISDIR" });
    await expect(removeOrphanOutputs(file, new Set())).rejects.toMatchObject({ code: "ENOTDIR", path: file });
    expect(await removeOrphanOutputs(path.join(dir, "missing"), new Set())).toBe(0);
  });

  it.each(["EACCES", "EIO"])("preserves %s errors from manifest, output, and cleanup reads", async (code) => {
    const dir = await makeTempDir();
    const error = Object.assign(new Error(`${code}: ${dir}`), { code, path: dir });
    vi.mocked(readFile).mockRejectedValueOnce(error);
    await expect(loadManifest(dir)).rejects.toBe(error);
    vi.mocked(createReadStream).mockImplementationOnce(() => {
      throw error;
    });
    await expect(isOutputFresh(dir, { hash: "a", outputHash: "b" }, "a")).rejects.toBe(error);
    vi.mocked(readdir).mockRejectedValueOnce(error);
    await expect(removeOrphanOutputs(dir, new Set())).rejects.toBe(error);
  });

  it("removes only orphan files and propagates deletion errors", async () => {
    const dir = await makeTempDir();
    await writeFile(path.join(dir, "keep"), "keep");
    await writeFile(path.join(dir, "manifest"), "manifest");
    await writeFile(path.join(dir, "orphan"), "orphan");
    expect(await removeOrphanOutputs(dir, new Set(["keep"]), { manifestBasename: "manifest" })).toBe(1);
    expect((await readdir(dir)).sort()).toEqual(["keep", "manifest"]);
    await mkdir(path.join(dir, "unexpected-directory"));
    await expect(removeOrphanOutputs(dir, new Set(["keep", "manifest"]))).rejects.toThrow();
  });
});

describe("mapPool", () => {
  it("waits for workers and retains every worker failure", async () => {
    const first = new Error("first conversion failed");
    const second = new Error("second conversion failed");
    const gate = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    let settled = false;
    const result = mapPool([0, 1], 2, async (item) => {
      if (item === 0) throw first;
      started.resolve();
      await gate.promise;
      throw second;
    }).catch((error: unknown) => {
      settled = true;
      return error;
    });
    await started.promise;
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(settled).toBe(false);
    gate.resolve();
    const failure = await result;
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([first, second]);
  });

  it("preserves order and bounds concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      active -= 1;
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

describe("writeTextIfChanged", () => {
  it("writes only when content changes", async () => {
    const dir = await makeTempDir("alchemy-write-if-changed-");
    const filePath = path.join(dir, "out.ts");
    expect(await writeTextIfChanged(filePath, "a\n")).toBe(true);
    expect(await writeTextIfChanged(filePath, "a\n")).toBe(false);
    expect(await writeTextIfChanged(filePath, "b\n")).toBe(true);
    expect(await readFile(filePath, "utf8")).toBe("b\n");
  });

  it("fails check mode when a generated file would change", async () => {
    const dir = await makeTempDir("alchemy-write-if-changed-check-");
    const filePath = path.join(dir, "out.ts");
    await writeFile(filePath, "a\n");

    await expect(writeTextIfChanged(filePath, "b\n", { check: true })).rejects.toThrow("Generated file is stale");
    expect(await readFile(filePath, "utf8")).toBe("a\n");
  });
});

describe("kebabToCamel", () => {
  it("converts kebab-case basenames", () => {
    expect(kebabToCamel("placeholder-destination")).toBe("placeholderDestination");
    expect(kebabToCamel("gear-slot-main-hand")).toBe("gearSlotMainHand");
  });
});

describe("sync-generated helpers", () => {
  it("classifies generated WebP and gear assets", () => {
    expect(WEBP_SUFFIX).toBe(".webp");
    expect(GEAR_PREFIX).toBe("gear-");
    expect(isWebpAsset("alchemy-logo.webp")).toBe(true);
    expect(isWebpAsset("alchemy-logo.png")).toBe(false);
    expect(isGearAsset("gear-sword-basic.webp")).toBe(true);
    expect(isGearAsset("sword-basic.webp")).toBe(false);
    expect(getAssetFiles({ "z.webp": {}, "a.png": {}, "a.webp": {} })).toEqual(["a.webp", "z.webp"]);
    expect(getGearFiles({ "gear-z-basic.webp": {}, "a.webp": {}, "gear-a-basic.webp": {} })).toEqual([
      "gear-a-basic.webp",
      "gear-z-basic.webp",
    ]);
  });
});
