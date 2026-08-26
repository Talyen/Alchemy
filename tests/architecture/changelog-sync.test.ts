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

  it("generates player patch notes from git, not CHANGELOG.md", () => {
    const source = readFileSync(join(ROOT, "scripts/generate-patch-notes.mjs"), "utf8");
    expect(source).not.toContain("readChangelog");
    expect(source).not.toContain("parseChangelogCommits");
    expect(source).toContain("getCommitsSinceTag");
  });

  it("previews player notes before tagging and supports --dry-run", () => {
    const runner = readFileSync(join(ROOT, "scripts/lib/release-runner.mjs"), "utf8");
    expect(runner).toContain("generate:patch-notes");
    expect(runner).toContain("--dry-run");
    expect(runner).toContain("previewPatchNotes");
    const release = readFileSync(join(ROOT, "scripts/release.mjs"), "utf8");
    expect(release).toContain("parseReleaseArgs");
  });
});
