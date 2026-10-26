import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { resolveSelectedPaths, parseChangedPathsArgs } from "../../scripts/lib/verification/changed-paths.mjs";
import { captureSourceDigest } from "../../scripts/check.mjs";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scoped-check-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  fs.mkdirSync(path.join(root, "owned"));
  fs.writeFileSync(path.join(root, "owned/a.ts"), "owned");
  fs.writeFileSync(path.join(root, "harness.ts"), "harness");
  fs.writeFileSync(path.join(root, "unrelated.ts"), "unrelated");
  git("add", ".");
  git("commit", "-m", "fixture");
  const digest = () => captureSourceDigest({ rootDir: root, paths: ["owned"], inputs: ["harness.ts"] }).hash;
  return { root, git, digest };
}
it("accepts unrelated edits and identical content while guarding owned membership, modes and dependencies", () => {
  const { root, digest } = fixture();
  const before = digest();
  fs.writeFileSync(path.join(root, "unrelated.ts"), "other work");
  expect(digest()).toBe(before);
  fs.writeFileSync(path.join(root, "owned/a.ts"), "owned");
  expect(digest()).toBe(before);
  fs.writeFileSync(path.join(root, "owned/new.ts"), "new");
  expect(digest()).not.toBe(before);
  fs.rmSync(path.join(root, "owned/new.ts"));
  expect(digest()).toBe(before);
  fs.renameSync(path.join(root, "owned/a.ts"), path.join(root, "owned/moved.ts"));
  expect(digest()).not.toBe(before);
  fs.renameSync(path.join(root, "owned/moved.ts"), path.join(root, "owned/a.ts"));
  expect(digest()).toBe(before);
  fs.chmodSync(path.join(root, "owned/a.ts"), 0o755);
  expect(digest()).not.toBe(before);
  fs.chmodSync(path.join(root, "owned/a.ts"), 0o644);
  expect(digest()).toBe(before);
  fs.writeFileSync(path.join(root, "harness.ts"), "changed harness");
  expect(digest()).not.toBe(before);
  fs.rmSync(path.join(root, "harness.ts"));
  expect(digest).toThrow("Required check input is missing");
});
it("rejects selected deletions, changed symlink targets and a different HEAD", () => {
  const { root, git, digest } = fixture();
  const before = digest();
  fs.rmSync(path.join(root, "owned/a.ts"));
  expect(digest()).not.toBe(before);
  fs.symlinkSync("../harness.ts", path.join(root, "owned/a.ts"));
  const linked = digest();
  fs.rmSync(path.join(root, "owned/a.ts"));
  fs.symlinkSync("../unrelated.ts", path.join(root, "owned/a.ts"));
  expect(digest()).not.toBe(linked);
  git("commit", "--allow-empty", "-m", "next head");
  expect(digest()).not.toBe(before);
});

it("keeps working and committed selections explicit and rejects typos while retaining deletions", () => {
  const { root, git } = fixture();
  const select = (args: string[]) => resolveSelectedPaths(root, parseChangedPathsArgs(args));
  expect(select(["--diff"])).toEqual([]);
  expect(select(["--committed", "HEAD"])).toContain("owned/a.ts");
  expect(() => select(["owned/typo.ts"])).toThrow("not a known deletion");
  expect(() => select(["--committed", "missing-ref"])).toThrow("Unknown commit");
  expect(() => select(["--committed", "HEAD", "--diff"])).toThrow("Choose");
  fs.rmSync(path.join(root, "owned/a.ts"));
  expect(select(["owned/a.ts"])).toEqual(["owned/a.ts"]);
  expect(select(["--diff"])).toEqual(["owned/a.ts"]);
  git("add", "-u");
  git("commit", "-m", "remove owned file");
  expect(select(["--diff"])).toEqual([]);
  expect(select(["--committed", "HEAD"])).toEqual(["owned/a.ts"]);
  expect(select(["owned/a.ts"])).toEqual(["owned/a.ts"]);
});

it("checks task commits and working paths without absorbing incorporated main changes", () => {
  const { root, git } = fixture();
  git("branch", "-M", "main");
  const base = git("rev-parse", "HEAD").toString().trim();
  git("checkout", "-b", "agent/scoped-task");
  git("config", "--local", "branch.agent/scoped-task.alchemyTaskBase", base);
  const select = () => resolveSelectedPaths(root, parseChangedPathsArgs(["--task"]));
  const digest = () => captureSourceDigest({ rootDir: root, paths: select(), inputs: ["harness.ts"] }).hash;
  expect(select()).toEqual([]);
  fs.writeFileSync(path.join(root, "owned/a.ts"), "first task commit");
  git("add", ".");
  git("commit", "-m", "first task change");
  fs.writeFileSync(path.join(root, "task.ts"), "second task commit");
  git("add", ".");
  git("commit", "-m", "second task change");
  expect(select()).toEqual(["owned/a.ts", "task.ts"]);
  git("checkout", "main");
  fs.writeFileSync(path.join(root, "main.ts"), "concurrent main work");
  git("add", ".");
  git("commit", "-m", "advance main");
  git("checkout", "agent/scoped-task");
  git("merge", "--no-edit", "main");
  git("mv", "owned/a.ts", "owned/moved.ts");
  fs.rmSync(path.join(root, "task.ts"));
  fs.writeFileSync(path.join(root, "new.ts"), "untracked task file");
  expect(select()).toEqual(["new.ts", "owned/a.ts", "owned/moved.ts", "task.ts"]);
  const before = digest();
  fs.writeFileSync(path.join(root, "appeared.ts"), "new scope during check");
  expect(digest()).not.toBe(before);
  expect(git("config", "--get", "branch.agent/scoped-task.alchemyTaskBase").toString().trim()).toBe(base);
});

it("rejects ambiguous or unrecorded task selection instead of narrowing its scope", () => {
  const { root, git } = fixture();
  git("branch", "-M", "main");
  const select = () => resolveSelectedPaths(root, parseChangedPathsArgs(["--task"]));
  expect(select).toThrow("isolated task checkout");
  git("checkout", "-b", "agent/task");
  expect(select).toThrow("No recorded task base");
  git("config", "--local", "branch.agent/task.alchemyTaskBase", "0".repeat(40));
  expect(select).toThrow("not an ancestor");
  for (const extra of [["--diff"], ["owned/a.ts"], ["--committed", "HEAD"]])
    expect(() => parseChangedPathsArgs(["--task", ...extra])).toThrow("Choose --task");
  git("checkout", "--detach", "HEAD");
  expect(select).toThrow("detached HEAD");
});
