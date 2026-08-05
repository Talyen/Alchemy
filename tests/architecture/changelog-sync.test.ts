import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("changelog release-time ownership", () => {
  it("syncs and promotes CHANGELOG.md only during release bumps", () => {
    const versionrc = JSON.parse(readFileSync(join(ROOT, ".versionrc.json"), "utf8"));
    expect(versionrc.scripts.prerelease).toBe("node scripts/sync-changelog.mjs");
    expect(versionrc.scripts.postbump).toBe("node scripts/release-changelog.mjs");
    expect(versionrc.skip?.changelog).toBe(true);
  });

  it("does not run day-to-day changelog hooks", () => {
    const hookConfig = readFileSync(join(ROOT, "lefthook.yml"), "utf8");
    expect(hookConfig).not.toContain("sync-changelog");
    expect(hookConfig).not.toMatch(/^post-commit:/m);
    expect(existsSync(join(ROOT, "scripts/sync-changelog-post-commit.mjs"))).toBe(false);
    expect(existsSync(join(ROOT, "scripts/sync-changelog-commit.mjs"))).toBe(false);
  });
});
