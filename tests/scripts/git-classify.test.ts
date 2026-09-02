import { describe, expect, it } from "vitest";

import { extractSubcommand, isDestructive } from "../../scripts/lib/git-classify.mjs";

describe("git-classify", () => {
  it("treats everyday commands as non-destructive", () => {
    for (const argv of [
      [],
      ["status"],
      ["commit", "-m", "reset --hard"],
      ["commit", "-m", "clean -fd"],
      ["add", "."],
      ["stash", "push"],
      ["log", "--oneline"],
      ["diff", "--quiet"],
      ["worktree", "add", ".worktrees/x", "main"],
      ["rebase", "main"],
      ["merge", "main"],
      ["pull"],
      ["fetch", "--all"],
      ["tag", "v1.2.3"],
    ]) {
      expect(isDestructive(argv), `git ${argv.join(" ")}`).toBe(false);
    }
  });

  it("flags destructive shapes", () => {
    for (const argv of [
      ["reset", "--hard"],
      ["reset", "--merge"],
      ["reset", "--keep"],
      ["checkout", "--", "."],
      ["checkout", "--", "file.txt"],
      ["checkout", "-f"],
      ["checkout", "--force"],
      ["checkout", "."],
      ["restore"],
      ["restore", "--staged", "file.txt"],
      ["clean", "-f"],
      ["clean", "-fd"],
      ["clean", "-xdf"],
      ["switch", "-f"],
      ["switch", "--discard-changes"],
      ["branch", "-D", "feature"],
      ["push", "--force"],
      ["push", "-f"],
      ["push", "--force-with-lease"],
    ]) {
      expect(isDestructive(argv), `git ${argv.join(" ")}`).toBe(true);
    }
  });

  it("keeps safe variants non-destructive", () => {
    for (const argv of [
      ["reset", "--soft", "HEAD"],
      ["reset"],
      ["reset", "-q", "HEAD"],
      ["checkout", "-b", "new-branch"],
      ["checkout", "main"],
      ["switch", "main"],
      ["clean", "-n"],
      ["clean", "--dry-run"],
      ["branch", "-d", "feature"],
      ["branch", "feature"],
      ["push", "origin", "main"],
    ]) {
      expect(isDestructive(argv), `git ${argv.join(" ")}`).toBe(false);
    }
  });

  it("classifies subcommands behind global options", () => {
    for (const argv of [
      ["-c", "alias.reset=reset --hard", "reset", "--hard"],
      ["-calias.x=y", "reset", "--hard"],
      ["-C", "/tmp", "clean", "-fd"],
      ["--git-dir=.git", "reset", "--hard"],
      ["--git-dir", ".git", "reset", "--hard"],
      ["--work-tree=/tmp", "checkout", "--", "."],
      ["--namespace", "alchemy", "restore"],
      ["--no-pager", "reset", "--hard"],
      ["--", "reset", "--hard"],
    ]) {
      expect(isDestructive(argv), `git ${argv.join(" ")}`).toBe(true);
    }
    expect(isDestructive(["-c", "alias.push=x", "push", "origin", "main"])).toBe(false);
    expect(isDestructive(["--bare", "status"])).toBe(false);
  });

  it("extracts subcommands through option preludes", () => {
    expect(extractSubcommand(["reset", "--hard"])).toEqual({
      subcommand: "reset",
      subIndex: 0,
      args: ["reset", "--hard"],
    });
    expect(extractSubcommand(["-c", "a=b", "status"])).toEqual({
      subcommand: "status",
      subIndex: 2,
      args: ["status"],
    });
    expect(extractSubcommand(["--no-pager", "log"])).toEqual({ subcommand: "log", subIndex: 1, args: ["log"] });
    expect(extractSubcommand(["-c", "a=b"])).toEqual({ subcommand: "", subIndex: -1, args: [] });
  });
});
