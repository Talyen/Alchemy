import { mkdtempSync, rmSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  root: "",
  failedSource: "",
  transform: vi.fn<(source: string, target: string) => Promise<void>>(),
}));
vi.mock("../../scripts/lib/sync-generated-helpers.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scripts/lib/sync-generated-helpers.mjs")>()),
  resolveRootDir: () => fixture.root,
}));
vi.mock("../../scripts/assets/asset-manifest.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scripts/assets/asset-manifest.mjs")>()),
  staticAssets: [
    { source: "a.png", target: "a.webp", width: 16, quality: 80 },
    { source: "b.png", target: "b.webp", width: 16, quality: 80 },
  ],
}));
vi.mock("sharp", () => ({
  default: (source: string) => ({
    resize: () => ({
      webp: () => ({ toFile: (target: string) => fixture.transform(source, target) }),
    }),
  }),
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    readdir: vi.fn(original.readdir),
    readFile: vi.fn(original.readFile),
    writeFile: vi.fn(original.writeFile),
    copyFile: vi.fn(async (source: string, target: string) => {
      if (source === fixture.failedSource) throw new Error("fixture processing failed");
      await original.copyFile(source, target);
    }),
  };
});

fixture.root = mkdtempSync(path.join(tmpdir(), "alchemy-art-music-"));
const { optimizeAssets } = await import("../../scripts/optimize-assets.mjs");
const { optimizeMusic } = await import("../../scripts/optimize-music.mjs");
const rawDir = path.join(fixture.root, "Raw Assets");
const gearDir = path.join(rawDir, "Gear");
const slotDir = path.join(gearDir, "Gear Slot Backgrounds");
const musicDir = path.join(rawDir, "Music");
const artOutput = path.join(fixture.root, "src/assets/optimized");
const musicOutput = path.join(fixture.root, "public/Music");
const slots = ["Body", "Weapon", "Accessory", "Trinket"];

afterAll(() => rmSync(fixture.root, { recursive: true, force: true }));

beforeEach(async () => {
  rmSync(fixture.root, { recursive: true, force: true });
  await mkdir(slotDir, { recursive: true });
  await mkdir(musicDir, { recursive: true });
  for (const slot of slots) await writeFile(path.join(slotDir, `${slot} Slot.png`), slot);
  await writeFile(path.join(gearDir, "Sword - Basic.png"), "sword");
  for (const name of ["a", "b"]) {
    await writeFile(path.join(rawDir, `${name}.png`), name);
    await writeFile(path.join(musicDir, `${name}.ogg`), name);
  }
  fixture.failedSource = "";
  fixture.transform.mockReset().mockImplementation(async (source, target) => {
    if (source === fixture.failedSource) throw new Error("fixture processing failed");
    await writeFile(target, `webp:${await readFile(source, "utf8")}`);
  });
  vi.mocked(copyFile).mockClear();
  vi.mocked(readdir).mockClear();
  vi.mocked(writeFile).mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe.each([
  { kind: "art", optimize: optimizeAssets, source: rawDir, output: artOutput, input: "png", extension: "webp" },
  { kind: "music", optimize: optimizeMusic, source: musicDir, output: musicOutput, input: "ogg", extension: "ogg" },
])("$kind manifest publication", ({ optimize, source, output, input, extension }) => {
  const manifestPath = path.join(output, ".asset-hashes.json");
  const manifestWrites = () => vi.mocked(writeFile).mock.calls.filter(([file]) => file === manifestPath);

  it("publishes a complete manifest and skips writes and processing on an unchanged run", async () => {
    await expect(optimize()).resolves.toEqual({ ok: true });
    expect(manifestWrites()).toHaveLength(1);
    const before = await readFile(manifestPath, "utf8");
    expect(Object.keys(JSON.parse(before))).toEqual(
      (await readdir(output)).filter((name) => name !== ".asset-hashes.json").sort(),
    );
    vi.mocked(writeFile).mockClear();
    vi.mocked(copyFile).mockClear();
    fixture.transform.mockClear();
    await expect(optimize()).resolves.toEqual({ ok: true });
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(manifestWrites()).toHaveLength(0);
    expect(copyFile).not.toHaveBeenCalled();
    expect(fixture.transform).not.toHaveBeenCalled();
  });

  it("detects same-size source replacements with restored timestamps", async () => {
    const sourcePath = path.join(source, `a.${input}`);
    const fixed = new Date("2020-01-01T00:00:00Z");
    await utimes(sourcePath, fixed, fixed);
    await optimize();
    await writeFile(sourcePath, "z");
    await utimes(sourcePath, fixed, fixed);
    await expect(optimize()).resolves.toEqual({ ok: true });
    expect(await readFile(path.join(output, `a.${extension}`), "utf8")).toContain("z");
  });

  it("migrates legacy metadata without reprocessing unchanged media", async () => {
    await optimize();
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(
      manifestPath,
      JSON.stringify(
        Object.fromEntries(
          Object.entries(manifest).map(([key, entry]) => [
            key,
            { ...(entry as object), mtimeMs: 1, size: 2, settingsSig: "old" },
          ]),
        ),
      ),
    );
    fixture.transform.mockClear();
    vi.mocked(copyFile).mockClear();
    await expect(optimize()).resolves.toEqual({ ok: true });
    expect(JSON.parse(await readFile(manifestPath, "utf8"))).toEqual(manifest);
    expect(fixture.transform).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
  });

  it("preserves outputs and skips processing when the manifest cannot be read", async () => {
    await optimize();
    const before = await readFile(manifestPath, "utf8");
    const orphan = path.join(output, `orphan.${extension}`);
    await writeFile(orphan, "keep");
    const error = Object.assign(new Error(`EACCES: ${manifestPath}`), { code: "EACCES", path: manifestPath });
    vi.mocked(readFile).mockRejectedValueOnce(error);
    vi.mocked(writeFile).mockClear();
    fixture.transform.mockClear();
    vi.mocked(copyFile).mockClear();
    await expect(optimize()).rejects.toBe(error);
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(await readFile(orphan, "utf8")).toBe("keep");
    expect(manifestWrites()).toHaveLength(0);
    expect(fixture.transform).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
  });

  it("skips publication and cleanup when an output cannot be read", async () => {
    await optimize();
    const before = await readFile(manifestPath, "utf8");
    const orphan = path.join(output, `orphan.${extension}`);
    await writeFile(orphan, "keep");
    const outputPath = path.join(output, `a.${extension}`);
    await rm(outputPath);
    await mkdir(outputPath);
    vi.mocked(writeFile).mockClear();
    await expect(optimize()).resolves.toMatchObject({ ok: false, error: expect.stringContaining("EISDIR") });
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(manifestWrites()).toHaveLength(0);
    expect(await readFile(orphan, "utf8")).toBe("keep");
  });

  it("preserves the manifest and orphans on failure, then repairs outputs and cleans up on retry", async () => {
    await optimize();
    const before = await readFile(manifestPath, "utf8");
    const orphan = path.join(output, `orphan.${extension}`);
    await writeFile(orphan, "keep until success");
    fixture.failedSource = path.join(source, `a.${input}`);
    await writeFile(fixture.failedSource, "updated a");
    await writeFile(path.join(source, `b.${input}`), "updated b");
    vi.mocked(writeFile).mockClear();
    await expect(optimize()).resolves.toMatchObject({
      ok: false,
      error: `FAILED a.${extension}: fixture processing failed`,
    });
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(manifestWrites()).toHaveLength(0);
    expect(await readFile(orphan, "utf8")).toBe("keep until success");
    expect(await readFile(path.join(output, `b.${extension}`), "utf8")).toContain("updated b");
    fixture.failedSource = "";
    await expect(optimize()).resolves.toEqual({ ok: true });
    expect(await readFile(path.join(output, `a.${extension}`), "utf8")).toContain("updated a");
    expect(Object.keys(JSON.parse(await readFile(manifestPath, "utf8")))).toEqual(Object.keys(JSON.parse(before)));
    await expect(readFile(orphan)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not create a manifest when the first run fails", async () => {
    fixture.failedSource = path.join(source, `a.${input}`);
    await expect(optimize()).resolves.toMatchObject({ ok: false });
    expect(manifestWrites()).toHaveLength(0);
    await expect(readFile(manifestPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("source discovery failures", () => {
  it.each([
    { label: "Gear", optimize: optimizeAssets, source: gearDir, output: artOutput },
    { label: "music", optimize: optimizeMusic, source: musicDir, output: musicOutput },
  ])("preserves $label outputs and reports directory read errors", async ({ optimize, source, output }) => {
    await optimize();
    const manifestPath = path.join(output, ".asset-hashes.json");
    const before = await readFile(manifestPath, "utf8");
    const files = await readdir(output);
    const error = Object.assign(new Error(`EACCES: scandir ${source}`), { code: "EACCES", path: source });
    vi.mocked(readdir).mockRejectedValueOnce(error);
    fixture.transform.mockClear();
    vi.mocked(copyFile).mockClear();
    vi.mocked(writeFile).mockClear();
    await expect(optimize()).rejects.toBe(error);
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(await readdir(output)).toEqual(files);
    expect(writeFile).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
    expect(fixture.transform).not.toHaveBeenCalled();
  });

  it.each([
    { label: "Gear", optimize: optimizeAssets, source: gearDir, output: artOutput },
    { label: "music", optimize: optimizeMusic, source: musicDir, output: musicOutput },
  ])("reports a missing $label source before creating outputs", async ({ optimize, source, output }) => {
    await rm(source, { recursive: true });
    await expect(optimize()).rejects.toMatchObject({ code: "ENOENT", path: source });
    await expect(readdir(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a readable music directory with no supported files before creating outputs", async () => {
    await rm(musicDir, { recursive: true });
    await mkdir(musicDir);
    await writeFile(path.join(musicDir, "notes.txt"), "not audio");
    await expect(optimizeMusic()).resolves.toEqual({ ok: false, error: `No music files found in ${musicDir}.` });
    await expect(readdir(musicOutput)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects missing required slot art before creating outputs", async () => {
    await rm(path.join(slotDir, "Body Slot.png"));
    await expect(optimizeAssets()).rejects.toThrow("Missing background art for slot: body");
    await expect(readdir(artOutput)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("still accepts a readable Gear directory with only slot backgrounds", async () => {
    await rm(path.join(gearDir, "Sword - Basic.png"));
    await expect(optimizeAssets()).resolves.toEqual({ ok: true });
    expect(await readdir(artOutput)).not.toContain("gear-sword-basic.webp");
    for (const slot of slots) expect(await readdir(artOutput)).toContain(`gear-slot-${slot.toLowerCase()}.webp`);
  });
});
