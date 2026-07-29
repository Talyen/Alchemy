import { mkdtemp, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeContentHash,
  isOutputFresh,
  loadManifest,
  resolveSourceHash,
  writeManifestIfChanged,
} from "../../scripts/lib/asset-manifest-cache.mjs";
import { mapPool } from "../../scripts/lib/map-pool.mjs";
import { writeTextIfChanged } from "../../scripts/lib/write-text-if-changed.mjs";
import { kebabToCamel } from "../../scripts/lib/kebab-to-camel.mjs";

describe("asset-manifest-cache", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.length = 0;
  });

  async function makeTempDir() {
    const dir = await mkdtemp(path.join(tmpdir(), "alchemy-asset-cache-"));
    tempDirs.push(dir);
    return dir;
  }

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

  it("skips re-hashing when mtimeMs and size match the stored entry", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "a.png");
    await writeFile(sourcePath, "bytes-a");

    const first = await resolveSourceHash(sourcePath, { quality: 80 }, 2, undefined);
    const second = await resolveSourceHash(sourcePath, { quality: 80 }, 2, first);

    expect(second).toEqual(first);
  });

  it("re-hashes when mtime or size changes", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "a.png");
    await writeFile(sourcePath, "bytes-a");
    const first = await resolveSourceHash(sourcePath, { quality: 80 }, 2, undefined);

    await writeFile(sourcePath, "bytes-a-changed");
    const second = await resolveSourceHash(sourcePath, { quality: 80 }, 2, first);

    expect(second.hash).not.toBe(first.hash);
    expect(second.size).not.toBe(first.size);
  });

  it("treats legacy string manifest entries as needing a full re-hash fingerprint", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, ".asset-hashes.json");
    await writeFile(manifestPath, `${JSON.stringify({ "a.webp": "abc123" }, null, 2)}\n`);

    const loaded = await loadManifest(manifestPath);
    expect(loaded["a.webp"]?.hash).toBe("abc123");
    expect(Number.isNaN(loaded["a.webp"]?.mtimeMs)).toBe(true);
  });

  it("round-trips object manifest entries and skips unchanged writes", async () => {
    const dir = await makeTempDir();
    const manifestPath = path.join(dir, ".asset-hashes.json");
    const entries = {
      "a.webp": { hash: "abc", mtimeMs: 1, size: 2 },
      "b.webp": { hash: "def", mtimeMs: 3, size: 4 },
    };

    expect(await writeManifestIfChanged(manifestPath, entries)).toBe(true);
    expect(await writeManifestIfChanged(manifestPath, entries)).toBe(false);

    const loaded = await loadManifest(manifestPath);
    expect(loaded).toEqual(entries);
  });

  it("reports output freshness from hash + existence", async () => {
    const dir = await makeTempDir();
    const outputPath = path.join(dir, "out.webp");
    await writeFile(outputPath, "out");

    expect(await isOutputFresh(outputPath, { hash: "abc", mtimeMs: 1, size: 1 }, "abc")).toBe(true);
    expect(await isOutputFresh(outputPath, { hash: "abc", mtimeMs: 1, size: 1 }, "zzz")).toBe(false);
    expect(await isOutputFresh(path.join(dir, "missing.webp"), { hash: "abc", mtimeMs: 1, size: 1 }, "abc")).toBe(
      false,
    );
  });

  it("does not treat equal mtime with different size as a fast-path hit", async () => {
    const dir = await makeTempDir();
    const sourcePath = path.join(dir, "a.png");
    await writeFile(sourcePath, "bytes-a");
    const first = await resolveSourceHash(sourcePath, { quality: 80 }, 2, undefined);

    // Keep mtime, change size via rewrite then restore mtime.
    await writeFile(sourcePath, "bytes-aa");
    await utimes(sourcePath, first.mtimeMs / 1000, first.mtimeMs / 1000);

    const second = await resolveSourceHash(sourcePath, { quality: 80 }, 2, {
      hash: first.hash,
      mtimeMs: first.mtimeMs,
      size: first.size,
    });
    expect(second.hash).not.toBe(first.hash);
  });
});

describe("mapPool", () => {
  it("preserves order and bounds concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

describe("writeTextIfChanged", () => {
  it("writes only when content changes", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "alchemy-write-if-changed-"));
    const filePath = path.join(dir, "out.ts");
    expect(await writeTextIfChanged(filePath, "a\n")).toBe(true);
    expect(await writeTextIfChanged(filePath, "a\n")).toBe(false);
    expect(await writeTextIfChanged(filePath, "b\n")).toBe(true);
    expect(await readFile(filePath, "utf8")).toBe("b\n");
  });
});

describe("kebabToCamel", () => {
  it("converts kebab-case basenames", () => {
    expect(kebabToCamel("placeholder-destination")).toBe("placeholderDestination");
    expect(kebabToCamel("gear-slot-main-hand")).toBe("gearSlotMainHand");
  });
});
