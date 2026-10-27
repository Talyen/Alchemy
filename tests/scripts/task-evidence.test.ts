import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { captureSourceDigest } from "../../scripts/check.mjs";
import { LOCAL_CHECK_INPUTS } from "../../scripts/lib/verification/test-commands.mjs";
import { latestTaskCheck, taskCheckIsCurrent } from "../../scripts/lib/agent/task-evidence.mjs";

it("only treats an exact task receipt as current", () => {
  const current = { main: "main-a", digest: { head: "task-a", hash: "source-a" }, selected: ["a", "b"] };
  const receipt = {
    selection: "task",
    status: "passed",
    mainHead: "main-a",
    sourceHead: "task-a",
    sourceDigest: "source-a",
    selectedPaths: ["b", "a"],
  };
  expect(taskCheckIsCurrent(receipt, current)).toBe(true);
  expect(taskCheckIsCurrent({ ...receipt, status: "failed" }, current)).toBe(true);
  for (const stale of [
    { ...receipt, mainHead: "main-old" },
    { ...receipt, sourceHead: "task-old" },
    { ...receipt, sourceDigest: "source-old" },
    { ...receipt, selectedPaths: ["a"] },
    { ...receipt, selection: "other" },
    { ...receipt, status: undefined },
  ])
    expect(taskCheckIsCurrent(stale, current)).toBe(false);
});

it("invalidates an actual receipt when source or main advances", () => {
  const root = mkdtempSync(join(tmpdir(), "alchemy-task-evidence-"));
  const git = (cwd: string, ...args: string[]) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  try {
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.name", "Test");
    git(root, "config", "user.email", "test@example.test");
    const directories = new Set(["scripts", "src/lib/localization", "src/lib/rng", "lint"]);
    for (const input of LOCAL_CHECK_INPUTS) {
      const file = join(root, input, ...(directories.has(input) ? ["fixture"] : []));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "fixture\n");
    }
    writeFileSync(join(root, ".gitignore"), "reports/\n");
    git(root, "add", ".");
    git(root, "commit", "-qm", "initial");
    const base = git(root, "rev-parse", "HEAD");
    const task = join(root, "task");
    git(root, "worktree", "add", "-qb", "agent/task", task);
    git(root, "config", "branch.agent/task.alchemyTaskBase", base);
    writeFileSync(join(task, "change.txt"), "task\n");
    const selected = ["change.txt"];
    const digest = captureSourceDigest({ rootDir: task, paths: selected });
    const receiptDir = join(task, "reports/runs/check-fixture/check");
    mkdirSync(receiptDir, { recursive: true });
    writeFileSync(
      join(receiptDir, "coverage.json"),
      JSON.stringify({
        selection: "task",
        status: "passed",
        mainHead: base,
        sourceHead: digest.head,
        sourceDigest: digest.hash,
        selectedPaths: selected,
      }),
    );
    expect(latestTaskCheck(task)?.current).toBe(true);
    writeFileSync(join(task, "change.txt"), "changed after check\n");
    expect(latestTaskCheck(task)?.current).toBe(false);
    writeFileSync(join(task, "change.txt"), "task\n");
    expect(latestTaskCheck(task)?.current).toBe(true);
    writeFileSync(join(root, "main-change.txt"), "main advanced\n");
    git(root, "add", "main-change.txt");
    git(root, "commit", "-qm", "advance main");
    expect(latestTaskCheck(task)?.current).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
