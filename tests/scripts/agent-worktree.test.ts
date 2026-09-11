import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("worktree removal", () => {
  it("preserves directories for empty task slugs and unregistered worktrees", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-worktree-"));
    try {
      const script = join(root, "scripts", "agent-worktree.mjs");
      mkdirSync(join(root, "scripts"));
      copyFileSync(join(process.cwd(), "scripts", "agent-worktree.mjs"), script);
      const saved = join(root, ".worktrees", "kept", "work.txt");
      mkdirSync(join(root, ".worktrees", "kept"), { recursive: true });
      writeFileSync(saved, "uncommitted work");
      expect(spawnSync("git", ["init", "-q"], { cwd: root }).status).toBe(0);

      const invalid = spawnSync(process.execPath, [script, "remove", "--task", "!!!"], { encoding: "utf8" });
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain("invalid --task slug");
      const unregistered = spawnSync(process.execPath, [script, "remove", "--task", "kept"], { encoding: "utf8" });
      expect(unregistered.status).toBe(1);
      expect(unregistered.stderr).toContain("Unregistered directory");
      expect(readFileSync(saved, "utf8")).toBe("uncommitted work");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
