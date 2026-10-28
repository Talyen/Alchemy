import { temporaryDirectories } from "../helpers/script-fixtures";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

// oxlint-disable-next-line typescript/ban-ts-comment -- scripts are JS without declarations
// @ts-ignore scripts are untyped JS helpers
import { validateRegistryEntries } from "../../scripts/assets/registry-validation.mjs";

const makeTempDir = temporaryDirectories("alchemy-registry-");

describe("validateRegistryEntries", () => {
  it("returns entries when valid", async () => {
    const entries = [
      { source: "a.png", target: "a.webp" },
      { source: "b.png", target: "b.webp" },
    ];
    await expect(validateRegistryEntries(entries)).resolves.toEqual(entries);
  });

  it("requires sources except for explicitly source-free registry entries", async () => {
    await expect(validateRegistryEntries([{ target: "a.ogg" }])).rejects.toThrow(
      "Asset source must be a non-empty string",
    );
    await expect(
      validateRegistryEntries([{ source: "", target: "a.ogg" }], { allowMissingSource: true }),
    ).rejects.toThrow("Asset source must be a non-empty string");
    await expect(validateRegistryEntries([{ target: "a.ogg" }], { allowMissingSource: true })).resolves.toHaveLength(1);
  });

  it("requires each target to be a non-empty string", async () => {
    for (const target of [undefined, "", 42]) {
      await expect(validateRegistryEntries([{ source: "a.png", target }])).rejects.toThrow(
        "Asset target must be a non-empty string",
      );
    }
  });

  it("reports invalid source and target in the same entry", async () => {
    await expect(
      validateRegistryEntries([{ source: "a.txt", target: "bad.png" }], {
        checkExport: true,
        sourcePattern: /\.png$/u,
        targetPattern: /\.webp$/u,
      }),
    ).rejects.toThrow(/Invalid target[\s\S]*Unsupported source/u);
  });

  it("checks every entry independently with stateful regular expressions", async () => {
    const sourcePattern = /\.png$/gu;
    sourcePattern.lastIndex = 2;
    await expect(
      validateRegistryEntries(
        [
          { source: "a.png", target: "a.webp" },
          { source: "b.png", target: "b.webp" },
        ],
        { sourcePattern, targetPattern: /\.webp$/gu },
      ),
    ).resolves.toHaveLength(2);
    expect(sourcePattern.lastIndex).toBe(2);
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
    const dir = makeTempDir();
    await writeFile(path.join(dir, "exists.png"), "x");
    await expect(
      validateRegistryEntries([{ source: "missing.png", target: "a.webp" }], { sourceDir: dir }),
    ).rejects.toThrow(/Missing asset source "missing\.png"/);
  });

  it("rejects directories masquerading as existing source files", async () => {
    const dir = makeTempDir();
    await mkdir(path.join(dir, "image.png"));
    await expect(
      validateRegistryEntries([{ source: "image.png", target: "a.webp" }], { sourceDir: dir }),
    ).rejects.toThrow('Asset source "image.png" is not a file');
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
