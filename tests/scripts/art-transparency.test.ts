import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { computeOutputHash } from "../../scripts/assets/asset-manifest-cache.mjs";

const fixture = vi.hoisted(() => ({
  root: "",
  icon: { source: "icon.png", target: "icon.webp", width: 16, quality: 80, requiresTransparency: true },
}));
vi.mock("../../scripts/assets/asset-pipeline-runner.mjs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../scripts/assets/asset-pipeline-runner.mjs")>();
  const { pathToFileURL } = await import("node:url");
  return {
    ...original,
    resolveRootDir: () => fixture.root,
    resolvePipelinePaths: (
      _url: string,
      options: { sourceSubpath: string[]; managedKey: "art" | "sounds" | "music" },
    ) =>
      original.resolvePipelinePaths(pathToFileURL(path.join(fixture.root, "scripts", "mock-entry.mjs")).href, options),
  };
});
vi.mock("../../scripts/assets/asset-manifest.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scripts/assets/asset-manifest.mjs")>()),
  staticAssets: [fixture.icon],
}));

fixture.root = mkdtempSync(path.join(tmpdir(), "alchemy-alpha-"));
const { optimizeAssets } = await import("../../scripts/optimize-assets.mjs");
const rawDir = path.join(fixture.root, "Raw Assets");
const outputDir = path.join(fixture.root, "src/assets/optimized");
const source = path.join(rawDir, "icon.png");
const output = path.join(outputDir, "icon.webp");
const manifest = path.join(outputDir, ".asset-hashes.json");

type ImageKind = "artwork" | "opaque RGB" | "opaque RGBA" | "empty" | "checkerboard" | "translucent only";
async function png(kind: ImageKind) {
  const channels = kind === "opaque RGB" ? 3 : 4;
  const pixels = Buffer.alloc(16 * 16 * channels, 255);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const offset = (y * 16 + x) * channels;
      pixels[offset] = kind === "checkerboard" ? ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 100 : 220) : 180;
      if (channels === 4) {
        pixels[offset + 3] =
          kind === "empty" ? 0 : kind === "translucent only" ? 128 : kind === "artwork" && x < 8 ? 0 : 255;
      }
    }
  }
  return sharp(pixels, { raw: { width: 16, height: 16, channels } })
    .png()
    .toBuffer();
}

async function snapshotOutputs() {
  return Promise.all(
    (await readdir(outputDir)).sort().map(async (name) => {
      const file = path.join(outputDir, name);
      return { name, bytes: (await readFile(file)).toString("base64"), mtime: (await stat(file)).mtimeMs };
    }),
  );
}

afterAll(() => rmSync(fixture.root, { recursive: true, force: true }));
beforeEach(async () => {
  rmSync(fixture.root, { recursive: true, force: true });
  fixture.icon.width = 16;
  fixture.icon.requiresTransparency = true;
  const slots = path.join(rawDir, "Gear/Gear Slot Backgrounds");
  await mkdir(slots, { recursive: true });
  for (const slot of ["Body", "Weapon", "Accessory", "Trinket"]) {
    await writeFile(path.join(slots, `${slot} Slot.png`), await png("opaque RGB"));
  }
  await writeFile(source, await png("artwork"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("required art transparency", () => {
  it("preserves real alpha, accepts opaque backgrounds elsewhere, and leaves fresh outputs untouched", async () => {
    await expect(optimizeAssets()).resolves.toEqual({ ok: true });
    expect((await sharp(output).stats()).isOpaque).toBe(false);
    const before = await snapshotOutputs();
    await expect(optimizeAssets({ check: true })).resolves.toEqual({ ok: true });
    await expect(optimizeAssets()).resolves.toEqual({ ok: true });
    expect(await snapshotOutputs()).toEqual(before);
  });

  it.each<ImageKind>(["opaque RGB", "opaque RGBA", "empty", "checkerboard", "translucent only"])(
    "rejects %s source pixels without replacing outputs, publishing a manifest, or removing orphans",
    async (kind) => {
      await optimizeAssets();
      await writeFile(path.join(outputDir, "orphan.webp"), "preserve until success");
      const before = await snapshotOutputs();
      await writeFile(source, await png(kind));
      for (const check of [true, false]) {
        await expect(optimizeAssets({ check })).resolves.toMatchObject({
          ok: false,
          error: expect.stringContaining("Source icon.png requires fully transparent pixels and visible artwork"),
        });
        expect(await snapshotOutputs()).toEqual(before);
      }
    },
  );

  it("validates prepared pixels even when the cached output hash matches", async () => {
    await optimizeAssets();
    await writeFile(
      output,
      await sharp(await png("checkerboard"))
        .webp()
        .toBuffer(),
    );
    const hashes = JSON.parse(await readFile(manifest, "utf8"));
    hashes["icon.webp"].outputHash = await computeOutputHash(output);
    await writeFile(manifest, `${JSON.stringify(hashes, null, 2)}\n`);
    const before = await snapshotOutputs();
    for (const check of [true, false]) {
      await expect(optimizeAssets({ check })).resolves.toMatchObject({
        ok: false,
        error: expect.stringContaining("Prepared icon.webp requires"),
      });
      expect(await snapshotOutputs()).toEqual(before);
    }
  });

  it("fingerprints the transparency requirement so enabling it invalidates an old receipt", async () => {
    fixture.icon.requiresTransparency = false;
    await optimizeAssets();
    const before = await snapshotOutputs();
    fixture.icon.requiresTransparency = true;
    await expect(optimizeAssets({ check: true })).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("Stale prepared asset"),
    });
    expect(await snapshotOutputs()).toEqual(before);
    await expect(optimizeAssets()).resolves.toEqual({ ok: true });
    await expect(optimizeAssets({ check: true })).resolves.toEqual({ ok: true });
  });

  it("rejects transparency lost during resizing before publishing staged bytes", async () => {
    await optimizeAssets();
    const before = await snapshotOutputs();
    fixture.icon.width = 1;
    await expect(optimizeAssets()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("Prepared icon.webp requires"),
    });
    expect(await snapshotOutputs()).toEqual(before);
  });
});
