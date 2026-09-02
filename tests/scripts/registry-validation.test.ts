import { mkdtemp, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore scripts are untyped JS helpers
import { validateRegistryEntries } from "../../scripts/lib/registry-validation.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function makeTempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "alchemy-registry-"));
  tempDirs.push(dir);
  return dir;
}

describe("validateRegistryEntries", () => {
  it("returns entries when valid", async () => {
    const entries = [
      { source: "a.png", target: "a.webp" },
      { source: "b.png", target: "b.webp" },
    ];
    await expect(validateRegistryEntries(entries)).resolves.toEqual(entries);
  });

  it("rejects duplicate sources", async () => {
    await expect(
      validateRegistryEntries([
        { source: "a.png", target: "a.webp" },
        { source: "a.png", target: "b.webp" },
      ]),
    ).rejects.toThrow(/Duplicate asset source "a\.png"/);
  });

  it("rejects duplicate targets", async () => {
    await expect(
      validateRegistryEntries([
        { source: "a.png", target: "a.webp" },
        { source: "b.png", target: "a.webp" },
      ]),
    ).rejects.toThrow(/Duplicate asset target "a\.webp"/);
  });

  it("rejects duplicate export names when checkExport is true", async () => {
    await expect(
      validateRegistryEntries(
        [
          { source: "a.png", target: "foo-bar.webp" },
          { source: "b.png", target: "fooBar.webp" },
        ],
        { checkExport: true },
      ),
    ).rejects.toThrow(/Duplicate asset export "fooBar"/);
  });

  it("rejects sources not matching sourcePattern", async () => {
    await expect(
      validateRegistryEntries([{ source: "a.txt", target: "a.ogg" }], {
        sourcePattern: /\.(ogg|wav|mp3)$/iu,
      }),
    ).rejects.toThrow(/Unsupported source/);
  });

  it("rejects targets not matching targetPattern", async () => {
    await expect(
      validateRegistryEntries([{ source: "a.wav", target: "a.mp3" }], {
        targetPattern: /\.ogg$/u,
      }),
    ).rejects.toThrow(/Invalid target/);
  });

  it("rejects missing source files when sourceDir is provided", async () => {
    const dir = await makeTempDir();
    await writeFile(path.join(dir, "exists.png"), "x");
    await expect(
      validateRegistryEntries([{ source: "missing.png", target: "a.webp" }], { sourceDir: dir }),
    ).rejects.toThrow(/Missing asset source "missing\.png"/);
  });

  it("collects multiple errors in one throw", async () => {
    await expect(
      validateRegistryEntries(
        [
          { source: "a.png", target: "dup.webp" },
          { source: "b.png", target: "dup.webp" },
          { source: "a.png", target: "other.webp" },
        ],
        { checkExport: false },
      ),
    ).rejects.toThrow(/Registry validation failed:/);
  });

  it("uses Registry validation failed prefix", async () => {
    try {
      await validateRegistryEntries([
        { source: "a.png", target: "a.webp" },
        { source: "a.png", target: "b.webp" },
      ]);
    } catch (error) {
      expect((error as Error).message).toMatch(/^Registry validation failed:/);
      return;
    }
    throw new Error("expected throw");
  });
});
