import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyReleaseVersionTag } from "../../scripts/lib/release-checks.mjs";

const ROOT = join(import.meta.dirname, "../..");

describe("verifyReleaseVersionTag", () => {
  it("returns the tag when it matches the version", () => {
    expect(verifyReleaseVersionTag("v0.1.0", "0.1.0")).toBe("v0.1.0");
  });

  it("throws when the tag is missing", () => {
    expect(() => verifyReleaseVersionTag("", "0.1.0")).toThrow(/RELEASE_TAG or GITHUB_REF_NAME is required/);
  });

  it("throws when the tag mismatches the version", () => {
    expect(() => verifyReleaseVersionTag("v0.2.0", "0.1.0")).toThrow(/does not match package\.json version/);
  });
});

describe("verify-release-version CLI", () => {
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
