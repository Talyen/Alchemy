import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeSyncedChangelog } from "../../scripts/sync-changelog.mjs";

/** Temp git repo with one conventional commit so getCommitsSinceTag has real data. */
function gitRepoWithCommit(message: string) {
  const root = mkdtempSync(join(tmpdir(), "alchemy-changelog-"));
  execSync("git init -q", { cwd: root });
  execSync("git config user.email test@example.com && git config user.name test", {
    cwd: root,
    shell: "/bin/sh",
  });
  writeFileSync(join(root, "seed.txt"), "seed", "utf8");
  execSync("git add . && git commit -qm init", { cwd: root, shell: "/bin/sh" });
  writeFileSync(join(root, "feature.txt"), "x", "utf8");
  execSync(`git add . && git commit -qm ${JSON.stringify(message)}`, { cwd: root, shell: "/bin/sh" });
  return root;
}

describe("sync-changelog", () => {
  it("inserts an unreleased block before versioned sections", () => {
    const root = gitRepoWithCommit("feat: add the thing");
    const changelog = [
      "# Changelog",
      "",
      "All notable changes to Alchemy are documented here.",
      "",
      "## [0.1.0] (2026-06-11)",
      "",
      "### Features",
      "",
      "- Initial release",
      "",
    ].join("\n");
    writeFileSync(join(root, "CHANGELOG.md"), changelog, "utf8");

    const synced = computeSyncedChangelog(changelog, root);
    expect(synced).toContain("## [Unreleased]");
    expect(synced.indexOf("## [Unreleased]")).toBeLessThan(synced.indexOf("## [0.1.0]"));
    expect(synced).toContain("add the thing");
    expect(synced).toContain("## [0.1.0] (2026-06-11)");
  });

  it("preserves versioned changelog sections while updating unreleased", () => {
    const root = gitRepoWithCommit("fix: repair the other thing");
    const changelog = [
      "# Changelog",
      "",
      "Header",
      "",
      "## [Unreleased]",
      "",
      "_No changes yet._",
      "",
      "## [0.1.0] (2026-06-11)",
      "",
      "### Features",
      "",
      "- Initial release",
      "",
    ].join("\n");
    writeFileSync(join(root, "CHANGELOG.md"), changelog, "utf8");

    const synced = computeSyncedChangelog(changelog, root);
    expect(readFileSync(join(root, "CHANGELOG.md"), "utf8")).toBe(changelog);
    expect(synced).toContain("repair the other thing");
    expect(synced).toContain("- Initial release");
    expect(synced).toContain("## [0.1.0] (2026-06-11)");
  });

  it("refuses to rewrite the changelog when git history is unreadable", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-changelog-"));
    // No git repo: getCommitsSinceTag cannot distinguish commits from failure.
    expect(() => computeSyncedChangelog("# Changelog\n", root)).toThrow(/git log failed/);
  });
});
