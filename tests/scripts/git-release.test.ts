import { temporaryDirectories } from "../helpers/script-fixtures";
import { execSync } from "node:child_process";
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCommitsSinceTag,
  latestVersionTag,
  previousVersionTag,
  resolvePatchNoteRange,
  assertValidSemver,
  assertValidTag,
} from "../../scripts/lib/release/git-release.mjs";

function git(root: string, command: string) {
  execSync(command, { cwd: root, shell: "/bin/sh" });
}

function gitRepo() {
  const root = createTemporaryDirectory("alchemy-git-release-");

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

const createTemporaryDirectory = temporaryDirectories();

describe("git-release", () => {
  it("accepts complete semantic versions and rejects malformed identifiers in versions and tags", () => {
    for (const version of ["0.1.0", "1.2.3-rc.0+build.01", "1.2.3-alpha-1"]) {
      expect(() => assertValidSemver(version)).not.toThrow();
      expect(() => assertValidTag(`v${version}`)).not.toThrow();
    }
    for (const version of ["01.2.3", "1.02.3", "1.2.3-01", "1.2.3-rc..1", "1.2.3+build."]) {
      expect(() => assertValidSemver(version)).toThrow("Invalid semantic version");
      expect(() => assertValidTag(`v${version}`)).toThrow("Invalid tag revision");
    }
    expect(() => assertValidTag("HEAD")).not.toThrow();
  });
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
    const root = createTemporaryDirectory("alchemy-git-release-nogit-");

    expect(getCommitsSinceTag(root, null)).toBeNull();
  });

  it("uses release ancestry for reruns and maintenance branches, including the first release", () => {
    const root = gitRepo();
    commitFile(root, "seed.txt", "chore: seed");
    git(root, "git tag v0.1.0");
    expect(previousVersionTag(root, "v0.1.0")).toBeNull();
    commitFile(root, "release.txt", "feat: second release");
    git(root, "git tag v0.2.0");
    commitFile(root, "later.txt", "feat: later release");
    git(root, "git tag v9.0.0");
    expect(resolvePatchNoteRange(root, "v0.2.0")).toEqual({ since: "v0.1.0", until: "v0.2.0" });

    git(root, "git checkout -qb maintenance v0.1.0");
    commitFile(root, "hotfix.txt", "fix: maintenance release");
    git(root, "git tag v0.1.1");
    expect(previousVersionTag(root, "0.1.1")).toBe("v0.1.0");
    expect(latestVersionTag(root)).toBe("v0.1.1");
    expect(resolvePatchNoteRange(root, null)).toEqual({ since: "v0.1.1", until: "HEAD" });
  });
});
