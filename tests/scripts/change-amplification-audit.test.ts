import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..", "..");

describe("change amplification audit", () => {
  it("runs on Windows-safe paths and accepts a since argument", () => {
    const output = execFileSync(process.execPath, ["scripts/audit-change-amplification.mjs", "--since=6 months ago"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("Since: 6 months ago");
    expect(output).toContain("clean:");
    expect(output).toContain("Co-edit signal:");
  });
});

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
});
