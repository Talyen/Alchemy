import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("verify-release-version", () => {
  it("passes when tag matches package.json", () => {
    const result = spawnSync("node", ["scripts/verify-release-version.mjs"], {
      cwd: ROOT,
      env: { ...process.env, RELEASE_TAG: "v0.1.0" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  });

  it("fails when tag mismatches package.json", () => {
    const result = spawnSync("node", ["scripts/verify-release-version.mjs"], {
      cwd: ROOT,
      env: { ...process.env, RELEASE_TAG: "v9.9.9" },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
  });
});
