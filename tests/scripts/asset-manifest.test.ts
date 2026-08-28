import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { staticAssets, validateAssetRegistry } from "../../scripts/assets/asset-manifest.mjs";

const repoRoot = path.resolve(__dirname, "..", "..");

const rawAssetsDir = path.join(repoRoot, "Raw Assets");
const hasRawAssets = existsSync(rawAssetsDir);

describe("asset manifest", () => {
  it("keeps registered sources, targets, and generated export names valid", async () => {
    await expect(validateAssetRegistry(staticAssets, hasRawAssets ? { sourceDir: rawAssetsDir } : {})).resolves.toEqual(
      staticAssets,
    );
  });
});
