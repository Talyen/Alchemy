import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
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
