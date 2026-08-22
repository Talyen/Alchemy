import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { staticAssets, validateAssetRegistry } from "../../scripts/assets/asset-manifest.mjs";

const repoRoot = path.resolve(__dirname, "..", "..");
// CI sparse-checkout excludes Raw Assets, so source-existence validation only
// runs where raw art is present.
const rawAssetsDir = path.join(repoRoot, "Raw Assets");
const hasRawAssets = existsSync(rawAssetsDir);

describe("asset manifest", () => {
  it("does not define duplicate optimized targets", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        [
          'import { staticAssets } from "./scripts/assets/asset-manifest.mjs";',
          "const targets = staticAssets.map((asset) => asset.target);",
          "console.log(JSON.stringify({ total: targets.length, unique: new Set(targets).size }));",
        ].join("\n"),
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    const { total, unique } = JSON.parse(output) as { total: number; unique: number };
    expect(unique).toBe(total);
  });

  it("keeps registered sources, targets, and generated export names valid", async () => {
    await expect(validateAssetRegistry(staticAssets, hasRawAssets ? { sourceDir: rawAssetsDir } : {})).resolves.toEqual(
      staticAssets,
    );
  });
});
