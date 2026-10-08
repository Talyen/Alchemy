import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { reviewDiff } from "../../scripts/agent-diff.mjs";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
it("retains both change layers, renames, deletions, untracked files and generated inventory under a bounded preview", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-diff-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  const write = (file: string, text: string | Buffer) => fs.writeFileSync(path.join(root, file), text);
  git("init");
  write(".gitignore", "reports/\n");
  write("reversed.ts", "original\n");
  write("rename.ts", "rename\n");
  write("delete.ts", "delete\n");
  write("move-only.ts", "unchanged move content\n");
  write("edited-move.ts", "edited move original\n");
  write("mode-only.ts", "changed executable mode\n");
  write("anchor.ts", "unchanged tracked content\n");
  if (process.platform !== "win32") fs.chmodSync(path.join(root, "mode-only.ts"), 0o755);
  git("add", ".");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "fixture",
  );
  write("reversed.ts", "staged\n");
  git("add", "reversed.ts");
  write("reversed.ts", "original\n");
  git("mv", "rename.ts", "renamed.ts");
  fs.unlinkSync(path.join(root, "delete.ts"));
  fs.renameSync(path.join(root, "move-only.ts"), path.join(root, "moved-only.ts"));
  fs.renameSync(path.join(root, "edited-move.ts"), path.join(root, "edited-moved.ts"));
  write("edited-moved.ts", "edited move original\nchanged after moving\n");
  fs.renameSync(path.join(root, "mode-only.ts"), path.join(root, "mode-moved.ts"));
  // Git tracks the user executable bit; a group-only executable is not equivalent.
  if (process.platform !== "win32") fs.chmodSync(path.join(root, "mode-moved.ts"), 0o654);
  write("new.ts", "new\n".repeat(2000));
  write("binary.png", Buffer.from([0, 1, 2]));
  write("catalog.generated.ts", "generated detail\n");
  const statusBefore = git("status", "--porcelain=v1", "-z");
  const indexBefore = fs.readFileSync(path.join(root, ".git/index"));
  const stale = new Date(Date.now() - 5_000);
  fs.utimesSync(path.join(root, "anchor.ts"), stale, stale);
  const result = reviewDiff(root, { budget: 2000 });
  const report = fs.readFileSync(result.report, "utf8");
  expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(2000);
  expect(result.text).toContain("omitted");
  for (const item of [
    "+staged",
    "-staged",
    "renamed.ts",
    "rename.ts",
    "delete.ts",
    "new.ts",
    "binary.png",
    "catalog.generated.ts",
  ])
    expect(report).toContain(item);
  expect(report).not.toContain("generated detail");
  expect(report).toContain("Exact unstaged move");
  expect(report).not.toContain("unchanged move content");
  expect(report).toContain("+changed after moving");
  if (process.platform !== "win32") expect(report).toContain("changed executable mode");
  const moved = reviewDiff(root, { paths: ["move-only.ts"], budget: 1200 });
  expect(moved.text).toContain('"moved-only.ts" <- "move-only.ts"');
  expect(moved.text).toContain("Exact unstaged move");
  expect(fs.readFileSync(reviewDiff(root, { full: true, paths: ["moved-only.ts"] }).report, "utf8")).toContain(
    "+unchanged move content",
  );
  expect(fs.readFileSync(path.join(root, ".git/index")).equals(indexBefore), "Review changed the real Git index").toBe(
    true,
  );
  expect(git("status", "--porcelain=v1", "-z")).toEqual(statusBefore);
  const expanded = fs.readFileSync(reviewDiff(root, { full: true, paths: ["catalog.generated.ts"] }).report, "utf8");
  expect(expanded).toContain("+generated detail");
  expect(expanded).toContain("reversed.ts");
  expect(expanded).not.toContain("+staged");
});

it("shows a selected patch before unrelated paths consume its budget and retains the complete inventory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-diff-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init");
  fs.writeFileSync(path.join(root, ".gitignore"), "reports/\n");
  fs.mkdirSync(path.join(root, "unrelated"));
  for (let index = 0; index < 100; index++)
    fs.writeFileSync(path.join(root, `unrelated/long-unrelated-file-name-${index}.ts`), "unrelated\n");
  fs.writeFileSync(path.join(root, "selected.ts"), "selected change\n");
  const result = reviewDiff(root, { paths: ["selected.ts"], budget: 1200 });
  expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(1200);
  expect(result.text).toContain("+selected change");
  expect(result.text).toContain("unrelated/: 0 selected, 100 other changed paths");
  expect(result.text).not.toContain("long-unrelated-file-name");
  const report = fs.readFileSync(result.report, "utf8");
  expect(report).toContain("long-unrelated-file-name-99.ts");
  expect(report).toContain("+selected change");
  expect(report).not.toContain("+unrelated");
});

it("bounds scoped status while keeping both layers, rename sources and unrelated inventory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-status-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init");
  fs.writeFileSync(path.join(root, ".gitignore"), "reports/\n");
  fs.writeFileSync(path.join(root, "old name.ts"), "before\n");
  git("add", ".");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "fixture",
  );
  git("mv", "old name.ts", "new name.ts");
  fs.writeFileSync(path.join(root, "new name.ts"), "after\n");
  fs.mkdirSync(path.join(root, "unrelated"));
  for (let index = 0; index < 100; index++) fs.writeFileSync(path.join(root, `unrelated/${index}.ts`), "noise\n");
  const scoped = reviewDiff(root, { statusOnly: true, paths: ["old name.ts"], budget: 1200 });
  expect(scoped.text).toContain('RM "new name.ts" <- "old name.ts"');
  expect(scoped.text).toContain("unrelated/: 0 selected, 100 other changed paths");
  expect(scoped.text).not.toContain("+after");
  expect(Buffer.byteLength(scoped.text)).toBeLessThanOrEqual(1200);
  const compact = reviewDiff(root, { statusOnly: true });
  expect(compact.text).not.toContain('"new name.ts"');
  expect(fs.readFileSync(compact.report, "utf8")).toContain('"unrelated/99.ts"');
});
