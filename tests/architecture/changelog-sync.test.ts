import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("changelog sync guard", () => {
  it(
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
