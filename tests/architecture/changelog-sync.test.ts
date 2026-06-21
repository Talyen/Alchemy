import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("changelog sync guard", () => {
  const isCI = !!process.env.CI;
  const isShipCheck = !!process.env.npm_lifecycle_event?.includes("ship");
  const runGuard = isCI || isShipCheck;

  it.skipIf(!runGuard)(
    "CHANGELOG.md unreleased section matches git log since the latest tag",
    () => {
      const result = spawnSync("node", ["scripts/sync-changelog.mjs", "--check"], {
        cwd: ROOT,
        encoding: "utf8",
      });

      if (result.status !== 0) {
        expect(result.stderr || result.stdout).toContain("out of sync");
      }
      expect(result.status).toBe(0);
    },
    15_000,
  );
});
