import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeSyncedChangelog } from "../../scripts/sync-changelog.mjs";

const SCRIPT_PATH = join(import.meta.dirname, "../../scripts/sync-changelog-post-commit.mjs");

function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function runPostCommitHook(root: string): string {
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ALCHEMY_REPO_ROOT: root },
  });
  expect(result.status).toBe(0);
  return `${result.stdout}${result.stderr}`;
}

function createGitRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "alchemy-changelog-post-commit-"));
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.name", "Alchemy Tests"]);
  git(root, ["config", "user.email", "alchemy-tests@example.com"]);
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n_No changes yet._\n", "utf8");
  git(root, ["add", "CHANGELOG.md"]);
  git(root, ["commit", "--quiet", "--no-verify", "-m", "chore(test): seed changelog"]);
  return root;
}

describe("sync-changelog-post-commit", () => {
  it("amends generated changelog content into the commit just created", () => {
    const root = createGitRoot();
    writeFileSync(join(root, "feature.txt"), "feature\n", "utf8");
    git(root, ["add", "feature.txt"]);
    git(root, ["commit", "--quiet", "--no-verify", "-m", "feat(test): add feature"]);

    const before = git(root, ["rev-parse", "HEAD"]);
    expect(runPostCommitHook(root)).toContain("Synchronized CHANGELOG.md");

    const after = git(root, ["rev-parse", "HEAD"]);
    expect(after).not.toBe(before);
    expect(git(root, ["log", "-2", "--format=%s"]).split("\n")).toEqual([
      "feat(test): add feature",
      "chore(test): seed changelog",
    ]);
    expect(git(root, ["show", "--format=", "--name-only", "HEAD"])).toContain("CHANGELOG.md");

    const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
    expect(changelog).toContain("- feat(test): add feature");
    expect(computeSyncedChangelog(changelog, root)).toBe(changelog);
    expect(git(root, ["status", "--short"])).toBe("");
  });

  it("does not overwrite separate changelog edits", () => {
    const root = createGitRoot();
    writeFileSync(join(root, "feature.txt"), "feature\n", "utf8");
    git(root, ["add", "feature.txt"]);
    git(root, ["commit", "--quiet", "--no-verify", "-m", "feat(test): add feature"]);
    writeFileSync(join(root, "CHANGELOG.md"), "manual edit\n", "utf8");

    const before = git(root, ["rev-parse", "HEAD"]);
    expect(runPostCommitHook(root)).toContain("Skipping automatic changelog sync");
    expect(git(root, ["rev-parse", "HEAD"])).toBe(before);
    expect(readFileSync(join(root, "CHANGELOG.md"), "utf8")).toBe("manual edit\n");
  });
});
