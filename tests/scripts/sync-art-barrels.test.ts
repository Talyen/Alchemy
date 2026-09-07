import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ root: "" }));
vi.mock("../../scripts/lib/sync-generated-helpers.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scripts/lib/sync-generated-helpers.mjs")>()),
  resolveRootDir: () => fixture.root,
}));
vi.mock("../../scripts/assets/asset-manifest.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scripts/assets/asset-manifest.mjs")>()),
  staticAssets: [{ source: "a.png", target: "a.webp", width: 16, quality: 80 }],
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    readFile: vi.fn(original.readFile),
    writeFile: vi.fn(original.writeFile),
    stat: vi.fn(original.stat),
  };
});

fixture.root = mkdtempSync(path.join(tmpdir(), "alchemy-art-barrels-"));
const { syncArtBarrels, syncAssets, syncGearArt } = await import("../../scripts/sync-art-barrels.mjs");
const outputDir = path.join(fixture.root, "src/assets/optimized");
const barrelDir = path.join(fixture.root, "src/lib/game-data");
const manifestPath = path.join(outputDir, ".asset-hashes.json");
const assetBarrel = path.join(barrelDir, "assets.generated.ts");
const gearBarrel = path.join(barrelDir, "gear-art.ts");
const validManifest = {
  "gear-sword-basic.webp": { hash: "sword", outputHash: "output", ignoredMetadata: true },
  "gear-slot-weapon.webp": "weapon",
  "gear-slot-trinket.webp": "trinket",
  "gear-slot-body.webp": "body",
  "gear-slot-accessory.webp": "accessory",
  "a.webp": "legacy",
};

async function setManifest(value: unknown) {
  await writeFile(manifestPath, JSON.stringify(value));
}

async function expectPreserved() {
  expect(await readFile(assetBarrel, "utf8")).toBe("existing assets");
  expect(await readFile(gearBarrel, "utf8")).toBe("existing gear");
  expect(vi.mocked(writeFile).mock.calls.filter(([file]) => file === assetBarrel || file === gearBarrel)).toHaveLength(
    0,
  );
}

afterAll(() => rmSync(fixture.root, { recursive: true, force: true }));
beforeEach(async () => {
  vi.mocked(readFile).mockReset();
  vi.mocked(writeFile).mockClear();
  vi.mocked(stat).mockReset();
  rmSync(fixture.root, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(barrelDir, { recursive: true });
  await setManifest(validManifest);
  for (const target of Object.keys(validManifest)) await writeFile(path.join(outputDir, target), target);
  await writeFile(assetBarrel, "existing assets");
  await writeFile(gearBarrel, "existing gear");
  vi.mocked(writeFile).mockClear();
  vi.mocked(readFile).mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("strict art barrel inputs", () => {
  it.each([null, [], {}, 42, "manifest"])("rejects an invalid manifest root: %j", async (value) => {
    await setManifest(value);
    await expect(syncArtBarrels()).rejects.toThrow(
      `Invalid art manifest "${manifestPath}": expected a non-empty object`,
    );
    await expectPreserved();
  });

  it("rejects malformed JSON without replacing either barrel", async () => {
    await writeFile(manifestPath, "{");
    await expect(syncArtBarrels()).rejects.toThrow(`Invalid art manifest "${manifestPath}": malformed JSON`);
    await expectPreserved();
  });

  it.each([null, [], 123, {}, { hash: 123 }])("rejects an invalid entry rather than dropping it: %j", async (entry) => {
    await setManifest({ ...validManifest, "broken.webp": entry });
    await expect(syncArtBarrels()).rejects.toThrow(`Invalid art manifest "${manifestPath}": entry "broken.webp"`);
    await expectPreserved();
  });

  it.each(["123.webp", "fooBar.webp", "../escape.webp", "image.png", 'quote".webp'])(
    "rejects unsafe target %s",
    async (target) => {
      await setManifest({ ...validManifest, [target]: "hash" });
      await expect(syncArtBarrels()).rejects.toThrow("Invalid target");
      await expectPreserved();
    },
  );

  it("rejects distinct valid filenames that produce the same export", async () => {
    await setManifest({ ...validManifest, "a-1.webp": "hash", "a1.webp": "hash" });
    await expect(syncArtBarrels()).rejects.toThrow('Duplicate asset export "a1"');
    await expectPreserved();
  });

  it.each(Object.keys(validManifest).filter((target) => target !== "gear-sword-basic.webp"))(
    "requires %s",
    async (target) => {
      const manifest: Record<string, unknown> = { ...validManifest };
      delete manifest[target];
      await setManifest(manifest);
      await expect(syncArtBarrels()).rejects.toThrow(`missing required targets: ${target}`);
      await expectPreserved();
    },
  );

  it.each(["missing", "directory"])("preserves filesystem errors for a %s manifest", async (kind) => {
    await rm(manifestPath);
    if (kind === "directory") await mkdir(manifestPath);
    await expect(syncArtBarrels()).rejects.toMatchObject({ code: kind === "missing" ? "ENOENT" : "EISDIR" });
    await expectPreserved();
  });

  it("retains the original manifest read error", async () => {
    const error = Object.assign(new Error(`EACCES: ${manifestPath}`), { code: "EACCES", path: manifestPath });
    vi.mocked(readFile).mockRejectedValueOnce(error);
    await expect(syncArtBarrels()).rejects.toBe(error);
    await expectPreserved();
  });

  it.each(["missing", "directory"])("rejects a %s optimized asset", async (kind) => {
    const target = path.join(outputDir, "gear-sword-basic.webp");
    await rm(target);
    if (kind === "directory") await mkdir(target);
    if (kind === "missing") await expect(syncArtBarrels()).rejects.toMatchObject({ code: "ENOENT", path: target });
    else
      await expect(syncArtBarrels()).rejects.toThrow(`entry "gear-sword-basic.webp" is not a regular file: ${target}`);
    await expectPreserved();
  });

  it("retains the original output inspection error", async () => {
    const error = Object.assign(new Error("EIO: asset stat failed"), { code: "EIO" });
    vi.mocked(stat).mockRejectedValueOnce(error);
    await expect(syncArtBarrels()).rejects.toBe(error);
    await expectPreserved();
  });
});

describe("art barrel synchronization", () => {
  it("reads one snapshot, accepts legacy and object hashes, and generates sorted matching exports", async () => {
    await syncArtBarrels();
    expect(vi.mocked(readFile).mock.calls.filter(([file]) => file === manifestPath)).toHaveLength(1);
    const assets = await readFile(assetBarrel, "utf8");
    const gear = await readFile(gearBarrel, "utf8");
    expect(assets.match(/optimized\/([^"\n]+)/g)).toEqual(
      Object.keys(validManifest)
        .sort()
        .map((target) => `optimized/${target}`),
    );
    expect(assets).toContain('export { default as gearSwordBasic } from "@/assets/optimized/gear-sword-basic.webp";');
    expect(gear).toContain('"sword-basic": gearArtAssets.gearSwordBasic,');
    expect(gear).not.toContain('"a":');
    expect(gear.indexOf('"slot-accessory"')).toBeLessThan(gear.indexOf('"slot-body"'));
    vi.mocked(writeFile).mockClear();
    await syncArtBarrels();
    await syncArtBarrels({ check: true });
    expect(writeFile).not.toHaveBeenCalled();
    expect(await readFile(assetBarrel, "utf8")).toBe(assets);
    expect(await readFile(gearBarrel, "utf8")).toBe(gear);
  });

  it.each([
    { name: "assets", sync: syncAssets, changed: assetBarrel, untouched: gearBarrel, text: "existing gear" },
    { name: "gear", sync: syncGearArt, changed: gearBarrel, untouched: assetBarrel, text: "existing assets" },
  ])("writes only the selected $name barrel", async ({ sync, changed, untouched, text }) => {
    await sync();
    expect(vi.mocked(writeFile).mock.calls.map(([file]) => file)).toEqual([changed]);
    expect(await readFile(untouched, "utf8")).toBe(text);
  });

  it.each([syncAssets, syncGearArt, syncArtBarrels])("validates all inputs for every entry point", async (sync) => {
    await rm(path.join(outputDir, "a.webp"));
    await expect(sync()).rejects.toMatchObject({ code: "ENOENT" });
    await expectPreserved();
  });

  it("reports stale barrels in check mode without writing", async () => {
    await expect(syncArtBarrels({ check: true })).rejects.toThrow("Generated file is stale");
    await expectPreserved();
  });

  it("does not require raw assets or infer a per-item gear inventory", async () => {
    const manifest: Record<string, unknown> = { ...validManifest };
    delete manifest["gear-sword-basic.webp"];
    await setManifest(manifest);
    await expect(syncArtBarrels()).resolves.toBeUndefined();
    expect(await readFile(gearBarrel, "utf8")).not.toContain("sword-basic");
  });
});
