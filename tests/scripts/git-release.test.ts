import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getCommitsSinceTag,
  latestVersionTag,
  previousVersionTag,
  resolvePatchNoteRange,
} from "../../scripts/lib/git-release.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function git(root: string, command: string) {
  execSync(command, { cwd: root, shell: "/bin/sh" });
}

function gitRepo() {
  const root = mkdtempSync(join(tmpdir(), "alchemy-git-release-"));
  tempDirs.push(root);
  git(root, "git init -q");
  git(root, "git config user.email test@example.com && git config user.name test");
  return root;
}

function commitFile(root: string, relativePath: string, message: string, body = "") {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, `${message}\n`, "utf8");
  git(root, "git add .");
  if (!body) {
    git(root, `git commit -qm ${JSON.stringify(message)}`);
    return;
  }
  const msgFile = join(root, ".git-commit-msg");
  writeFileSync(msgFile, `${message}\n\n${body}\n`, "utf8");
  git(root, `git commit -q --cleanup=verbatim -F ${JSON.stringify(msgFile)}`);
  rmSync(msgFile);
}

describe("git-release", () => {
  it("returns subject, body, and changed paths for commits since a tag", () => {
    const root = gitRepo();
    commitFile(root, "seed.txt", "chore: seed");
    git(root, "git tag v0.1.0");
    commitFile(
      root,
      "src/lib/cards.ts",
      "feat(cards): add meteor shower",
      "Players can now rain meteors on a row.\n\nUser-Facing: yes",
    );
    writeFileSync(join(root, "src/lib/cards.ts"), "updated\n", "utf8");
    mkdirSync(join(root, "public"), { recursive: true });
    writeFileSync(join(root, "public/icon.png"), "png\n", "utf8");
    git(root, 'git add . && git commit -qm "feat(cards): add art for meteor shower"');

    const commits = getCommitsSinceTag(root, "v0.1.0");
    expect(commits).not.toBeNull();
    expect(commits?.map((commit) => commit.subject)).toEqual([
      "feat(cards): add art for meteor shower",
      "feat(cards): add meteor shower",
    ]);
    const meteor = commits?.find((commit) => commit.subject === "feat(cards): add meteor shower");
    expect(meteor?.body).toContain("Players can now rain meteors on a row.");
    expect(meteor?.files).toEqual(["src/lib/cards.ts"]);
    const art = commits?.find((commit) => commit.subject.includes("art"));
    expect(art?.files.sort()).toEqual(["public/icon.png", "src/lib/cards.ts"]);
  });

  it("resolves previous tags and patch-note ranges for a release tag", () => {
    const root = gitRepo();
    commitFile(root, "seed.txt", "chore: seed");
    git(root, "git tag v0.1.0");
    commitFile(root, "src/a.ts", "feat: add a");
    git(root, "git tag v0.2.0");
    commitFile(root, "src/b.ts", "feat: add b");

    expect(latestVersionTag(root)).toBe("v0.2.0");
    expect(previousVersionTag(root, "v0.2.0")).toBe("v0.1.0");
    expect(resolvePatchNoteRange(root, "v0.2.0")).toEqual({ since: "v0.1.0", until: "v0.2.0" });
    expect(resolvePatchNoteRange(root, null)).toEqual({ since: "v0.2.0", until: "HEAD" });

    const released = getCommitsSinceTag(root, "v0.1.0", { until: "v0.2.0" });
    expect(released?.map((commit) => commit.subject)).toEqual(["feat: add a"]);
  });

  it("returns null when git log cannot run", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-git-release-nogit-"));
    tempDirs.push(root);
    expect(getCommitsSinceTag(root, null)).toBeNull();
  });
});
