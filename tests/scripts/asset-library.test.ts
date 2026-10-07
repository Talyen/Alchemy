import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const selection = vi.hoisted(() => ({
  asset: { source: "selected.png", target: "selected.webp", width: 16, quality: 80 },
}));
vi.mock("../../scripts/assets/asset-manifest.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scripts/assets/asset-manifest.mjs")>()),
  staticAssets: [selection.asset],
}));
vi.mock("../../scripts/assets/gear-assets.mjs", () => ({ gearAssets: [] }));
vi.mock("../../scripts/assets/music-assets.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scripts/assets/music-assets.mjs")>()),
  musicAssets: [],
}));
vi.mock("../../scripts/assets/sound-assets.mjs", () => ({
  generatedSoundAssets: [],
  curatedSoundFiles: [],
  validateSoundAssetRegistry: vi.fn(),
  mp3FallbackName: (name: string) => name.replace(".ogg", ".mp3"),
  soundEntryOwner: () => "generated",
}));
const fixture = vi.hoisted(() => ({ root: "" }));
vi.mock("../../scripts/assets/asset-pipeline-runner.mjs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../scripts/assets/asset-pipeline-runner.mjs")>();
  return {
    ...original,
    resolvePipelinePaths: () => {
      if (!fixture.root) throw new Error("Initialize the isolated checkout before importing an optimizer.");
      return {
        rootDir: fixture.root,
        outputDir: path.join(fixture.root, "src/assets/optimized"),
        manifestPath: path.join(fixture.root, "src/assets/optimized/.asset-hashes.json"),
      };
    },
  };
});
fixture.root = await mkdtemp(path.join(os.tmpdir(), "alchemy-library-checkout-"));
const { optimizeAssets } = await import("../../scripts/optimize-assets.mjs");
const { checkAssetOutputs, preflightSelectedSources } = await import("../../scripts/assets/check-asset-outputs.mjs");
const { resolveAssetSource, assetLibraryRoot } = await import("../../scripts/assets/asset-library.mjs");
let directory: string;
let library: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "alchemy-library-"));
  await rm(fixture.root, { recursive: true, force: true });
  library = path.join(directory, "external library");
  await mkdir(library);
  vi.stubEnv("ASSET_LIBRARY_ROOT", library);
  selection.asset.width = 16;
  selection.asset.source = "selected.png";
  await writeFile(
    path.join(library, "selected.png"),
    await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } })
      .png()
      .toBuffer(),
  );
  for (const folder of ["public/Music", "public/sounds"]) {
    await mkdir(path.join(fixture.root, folder), { recursive: true });
    await writeFile(path.join(fixture.root, folder, ".asset-hashes.json"), "{}\n");
  }
  await optimizeAssets();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
  await rm(fixture.root, { recursive: true, force: true });
});

it("checks committed bytes without a library and rejects corruption or selection/settings drift", async () => {
  vi.stubEnv("ASSET_LIBRARY_ROOT", path.join(directory, "unavailable"));
  await expect(checkAssetOutputs(fixture.root)).resolves.toBeUndefined();
  selection.asset.width = 32;
  await expect(checkAssetOutputs(fixture.root)).rejects.toThrow("selection/settings changed");
  selection.asset.width = 16;
  selection.asset.source = "replacement.png";
  await expect(checkAssetOutputs(fixture.root)).rejects.toThrow("selection/settings changed");
  selection.asset.source = "selected.png";
  await writeFile(path.join(fixture.root, "src/assets/optimized/selected.webp"), "corrupt");
  await expect(checkAssetOutputs(fixture.root)).rejects.toThrow("output bytes changed");
});

it("detects local source changes and preserves prepared files when a selected source disappears", async () => {
  const output = path.join(fixture.root, "src/assets/optimized/selected.webp");
  const before = await readFile(output);
  await writeFile(path.join(library, "selected.png"), "changed");
  await expect(optimizeAssets({ check: true })).resolves.toMatchObject({ ok: false });
  await rm(path.join(library, "selected.png"));
  await expect(optimizeAssets()).rejects.toThrow("Existing outputs were preserved");
  expect(await readFile(output)).toEqual(before);
});

it("automatically follows folder moves and renames without changing selections or prepared bytes", async () => {
  const output = path.join(fixture.root, "src/assets/optimized/selected.webp");
  const receipt = path.join(fixture.root, "src/assets/optimized/.asset-hashes.json");
  const before = await readFile(output);
  const beforeReceipt = await readFile(receipt);
  await mkdir(path.join(library, "reorganized"));
  await rename(path.join(library, "selected.png"), path.join(library, "reorganized/renamed.png"));
  // A same-named replacement must never win over the original bytes.
  await writeFile(path.join(library, "reorganized/selected.png"), "different revision");
  await expect(preflightSelectedSources(fixture.root)).resolves.toBeUndefined();
  await expect(optimizeAssets({ check: true })).resolves.toEqual({ ok: true });
  expect(resolveAssetSource(selection.asset.source)).toBe(path.join(library, "reorganized/renamed.png"));
  await rename(path.join(library, "reorganized/renamed.png"), path.join(library, "moved-again.png"));
  await expect(optimizeAssets()).resolves.toEqual({ ok: true });
  expect(await readFile(output)).toEqual(before);
  expect(await readFile(receipt)).toEqual(beforeReceipt);
  expect(selection.asset.source).toBe("selected.png");
  // Restoring the canonical source makes explicit revisions take precedence.
  await writeFile(path.join(library, "selected.png"), "changed");
  await expect(optimizeAssets({ check: true })).resolves.toMatchObject({ ok: false });
});

it("does not recover through symlinks or receipts belonging to another selection/recipe", async () => {
  const { symlink } = await import("node:fs/promises");
  const output = path.join(fixture.root, "src/assets/optimized/selected.webp");
  const before = await readFile(output);
  await rename(path.join(library, "selected.png"), path.join(directory, "original.png"));
  await symlink(path.join(directory, "original.png"), path.join(library, "linked.png"));
  await expect(optimizeAssets()).rejects.toThrow("No verified moved source");
  await rename(path.join(directory, "original.png"), path.join(library, "renamed.png"));
  selection.asset.width = 32;
  await expect(optimizeAssets()).rejects.toThrow("No verified moved source");
  selection.asset.width = 16;
  selection.asset.source = "another-selection.png";
  await expect(optimizeAssets()).rejects.toThrow("No verified moved source");
  expect(await readFile(output)).toEqual(before);
});

it("resolves an external root and prevents absolute or escaping references", () => {
  expect(assetLibraryRoot()).toBe(library);
  expect(resolveAssetSource("selected.png")).toBe(path.join(library, "selected.png"));
  expect(() => resolveAssetSource("../other.png")).toThrow("library-relative");
  expect(() => resolveAssetSource("/other.png")).toThrow("library-relative");
});

it("verifies application icons without sources and catches recipe, source, or output changes", async () => {
  const { checkIconAssets, iconSource, iconOutputs } = await import("../../scripts/assets/icon-assets.mjs");
  const master = path.join(library, iconSource);
  await mkdir(path.dirname(master), { recursive: true });
  await writeFile(master, "icon master");
  const generator = path.join(fixture.root, "scripts/generate-icons.mjs");
  await mkdir(path.dirname(generator), { recursive: true });
  await writeFile(generator, "icon conversion recipe");
  for (const target of iconOutputs) {
    const output = path.join(fixture.root, target);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, target);
  }
  await checkIconAssets(fixture.root, { record: true });
  await rename(master, path.join(library, "renamed-icon.png"));
  await expect(checkIconAssets(fixture.root)).resolves.toBeUndefined();
  await rename(path.join(library, "renamed-icon.png"), master);
  vi.stubEnv("ASSET_LIBRARY_ROOT", path.join(directory, "unavailable"));
  await expect(checkIconAssets(fixture.root, { outputsOnly: true })).resolves.toBeUndefined();
  await writeFile(generator, "updated recipe");
  await expect(checkIconAssets(fixture.root, { outputsOnly: true })).rejects.toThrow("icon/source/settings changed");
  await writeFile(generator, "icon conversion recipe");
  vi.stubEnv("ASSET_LIBRARY_ROOT", library);
  await writeFile(master, "updated master");
  await expect(checkIconAssets(fixture.root)).rejects.toThrow("icon/source/settings changed");
  await writeFile(master, "icon master");
  await writeFile(path.join(fixture.root, iconOutputs[0]!), "corrupt");
  await expect(checkIconAssets(fixture.root, { outputsOnly: true })).rejects.toThrow("icon/source/settings changed");
});
