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
  write("new.ts", "new\n".repeat(2000));
  write("binary.png", Buffer.from([0, 1, 2]));
  write("catalog.generated.ts", "generated detail\n");
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
  const expanded = fs.readFileSync(reviewDiff(root, { full: true, paths: ["catalog.generated.ts"] }).report, "utf8");
  expect(expanded).toContain("+generated detail");
  expect(expanded).toContain("reversed.ts");
  expect(expanded).not.toContain("+staged");
});
