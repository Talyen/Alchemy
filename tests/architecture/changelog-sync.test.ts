import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

  it("keeps the pre-push changelog guard non-mutating", () => {
    const hook = readFileSync(join(ROOT, "scripts/sync-changelog-commit.mjs"), "utf8");
    const syncModule = readFileSync(join(ROOT, "scripts/sync-changelog.mjs"), "utf8");
    expect(hook).toContain("computeSyncedChangelog");
    expect(hook).not.toContain("git add");
    expect(hook).not.toContain("git commit");
    expect(syncModule).toContain("isMainModule(import.meta.url)");
  });

  it("automates changelog sync after commits without weakening the pre-push guard", () => {
    const hookConfig = readFileSync(join(ROOT, "lefthook.yml"), "utf8");
    const postCommitHook = readFileSync(join(ROOT, "scripts/sync-changelog-post-commit.mjs"), "utf8");

    expect(hookConfig).toContain("post-commit:");
    expect(hookConfig).toContain("scripts/sync-changelog-post-commit.mjs");
    expect(postCommitHook).toContain("computeSyncedChangelog");
    expect(postCommitHook).toContain('"--amend", "--no-edit", "--no-verify"');
    expect(postCommitHook).toContain("hasUncommittedChangelog");
  });
});
