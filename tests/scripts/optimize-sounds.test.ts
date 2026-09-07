import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ root: "", convert: vi.fn<(args: string[]) => Promise<void>>() }));
vi.mock("../../scripts/lib/sync-generated-helpers.mjs", () => ({ resolveRootDir: () => fixture.root }));
vi.mock("../../scripts/assets/sound-assets.mjs", () => ({
  generatedSoundAssets: [{ source: "raw.ogg", target: "generated.ogg" }],
  curatedSoundFiles: ["curated.ogg"],
  validateSoundAssetRegistry: vi.fn(),
}));
vi.mock("ffmpeg-static", () => ({ default: "fixture-ffmpeg" }));
vi.mock("node:child_process", () => ({
  execFile: (_file: string, args: string[], callback: (error: unknown, stdout?: string, stderr?: string) => void) => {
    fixture.convert(args).then(() => callback(null, "", ""), callback);
  },
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, writeFile: vi.fn(original.writeFile) };
});

fixture.root = mkdtempSync(path.join(tmpdir(), "alchemy-sounds-"));
const { optimizeSounds } = await import("../../scripts/optimize-sounds.mjs");
const sourceDir = path.join(fixture.root, "Raw Assets", "Sound Effects");
const outputDir = path.join(fixture.root, "public", "sounds");
const manifestPath = path.join(outputDir, ".asset-hashes.json");
const manifestWrites = () => vi.mocked(writeFile).mock.calls.filter(([file]) => file === manifestPath);

async function convert(args: string[]) {
  const source = args[args.indexOf("-i") + 1];
  await writeFile(args[args.length - 1], `mp3:${await readFile(source, "utf8")}`);
}

describe("sound manifest publication", () => {
  beforeEach(async () => {
    rmSync(fixture.root, { recursive: true, force: true });
    await mkdir(sourceDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(sourceDir, "raw.ogg"), "raw audio");
    await writeFile(path.join(outputDir, "curated.ogg"), "curated audio");
    fixture.convert.mockReset().mockImplementation(convert);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(writeFile).mockClear();
  });

  afterAll(() => rmSync(fixture.root, { recursive: true, force: true }));

  it("writes one complete manifest and performs no writes or conversions on an unchanged run", async () => {
    await expect(optimizeSounds()).resolves.toEqual({ ok: true });
    expect(manifestWrites()).toHaveLength(1);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    expect(Object.keys(manifest)).toEqual(["curated.mp3", "curated.ogg", "generated.mp3", "generated.ogg"]);
    expect(manifest["curated.mp3"].owner).toBe("curated");
    expect(manifest["generated.mp3"].owner).toBe("generated");
    vi.mocked(writeFile).mockClear();
    fixture.convert.mockClear();
    await expect(optimizeSounds()).resolves.toEqual({ ok: true });
    expect(manifestWrites()).toHaveLength(0);
    expect(fixture.convert).not.toHaveBeenCalled();
  });

  it.each([
    {
      source: path.join(sourceDir, "raw.ogg"),
      ogg: "generated.ogg",
      mp3: "generated.mp3",
      before: "raw audio",
      after: "new audio",
    },
    {
      source: path.join(outputDir, "curated.ogg"),
      ogg: "curated.ogg",
      mp3: "curated.mp3",
      before: "curated audio",
      after: "changed audio",
    },
  ])(
    "refreshes $mp3 when source bytes change with preserved timestamps",
    async ({ source, ogg, mp3, before, after }) => {
      const fixed = new Date("2020-01-01T00:00:00Z");
      expect(before.length).toBe(after.length);
      await utimes(source, fixed, fixed);
      await optimizeSounds();
      await writeFile(source, after);
      await utimes(source, fixed, fixed);
      await expect(optimizeSounds()).resolves.toEqual({ ok: true });
      expect(await readFile(path.join(outputDir, ogg), "utf8")).toBe(after);
      expect(await readFile(path.join(outputDir, mp3), "utf8")).toBe(`mp3:${after}`);
    },
  );

  it("removes old metadata without converting or changing sound ownership", async () => {
    await optimizeSounds();
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
    fixture.convert.mockClear();
    await expect(optimizeSounds()).resolves.toEqual({ ok: true });
    expect(JSON.parse(await readFile(manifestPath, "utf8"))).toEqual(manifest);
    expect(fixture.convert).not.toHaveBeenCalled();
  });

  it("preserves the previous manifest and orphans when fallback conversion fails", async () => {
    await optimizeSounds();
    const before = await readFile(manifestPath, "utf8");
    await writeFile(path.join(outputDir, "orphan.ogg"), "keep on failure");
    await writeFile(path.join(outputDir, "generated.mp3"), "corrupt output");
    fixture.convert.mockRejectedValue(new Error("encoder failed"));
    vi.mocked(writeFile).mockClear();
    await expect(optimizeSounds()).rejects.toThrow("encoder failed");
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(manifestWrites()).toHaveLength(0);
    expect(await readFile(path.join(outputDir, "orphan.ogg"), "utf8")).toBe("keep on failure");
    fixture.convert.mockImplementation(convert);
    await expect(optimizeSounds()).resolves.toEqual({ ok: true });
    await expect(readFile(path.join(outputDir, "orphan.ogg"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not build fallbacks from a stale OGG after its source fails", async () => {
    await optimizeSounds();
    const before = await readFile(manifestPath, "utf8");
    rmSync(path.join(sourceDir, "raw.ogg"));
    await writeFile(path.join(outputDir, "orphan.ogg"), "keep on failure");
    await writeFile(path.join(outputDir, "generated.mp3"), "old fallback");
    fixture.convert.mockClear();
    vi.mocked(writeFile).mockClear();
    await expect(optimizeSounds()).resolves.toMatchObject({ ok: false });
    expect(fixture.convert).not.toHaveBeenCalled();
    expect(manifestWrites()).toHaveLength(0);
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(await readFile(path.join(outputDir, "generated.mp3"), "utf8")).toBe("old fallback");
    expect(await readFile(path.join(outputDir, "orphan.ogg"), "utf8")).toBe("keep on failure");
  });

  it("identifies missing curated sources and preserves the previous manifest", async () => {
    await optimizeSounds();
    const before = await readFile(manifestPath, "utf8");
    rmSync(path.join(outputDir, "curated.ogg"));
    await expect(optimizeSounds()).rejects.toThrow("Missing curated sound: curated.ogg");
    expect(await readFile(manifestPath, "utf8")).toBe(before);
  });
});
