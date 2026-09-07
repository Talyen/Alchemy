import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { staticAssets, validateAssetRegistry } from "../../scripts/assets/asset-manifest.mjs";

const repoRoot = path.resolve(__dirname, "..", "..");

const rawAssetsDir = path.join(repoRoot, "Raw Assets");
const hasRawAssets = existsSync(rawAssetsDir);

describe("asset manifest", () => {
  it.each(["123.webp", "fooBar.webp", "../escape.webp", "image.png"])(
    "rejects invalid export target %s",
    async (target) => {
      await expect(validateAssetRegistry([{ source: "fixture.png", target }])).rejects.toThrow("Invalid target");
    },
  );

  it("rejects filenames that collapse to the same export", async () => {
    await expect(
      validateAssetRegistry([
        { source: "first.png", target: "a-1.webp" },
        { source: "second.png", target: "a1.webp" },
      ]),
    ).rejects.toThrow('Duplicate asset export "a1"');
  });

  it("keeps registered sources, targets, and generated export names valid", async () => {
    await expect(validateAssetRegistry(staticAssets, hasRawAssets ? { sourceDir: rawAssetsDir } : {})).resolves.toEqual(
      staticAssets,
    );
  });
});
