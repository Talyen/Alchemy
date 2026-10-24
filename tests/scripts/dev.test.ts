import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { commandInvocation } from "../../scripts/lib/command-invocation.mjs";

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

it("serves current main from a stale workspace, preserves task previews, and refuses a missing main checkout", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "alchemy dev-")));
  temporary.push(root);
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", ["-c", "core.hooksPath=", ...args], { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  git(root, "init", "-qb", "main");
  git(root, "config", "user.name", "Dev test");
  git(root, "config", "user.email", "dev@example.invalid");
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.resolve("scripts/dev.mjs"), path.join(root, "scripts/dev.mjs"));
  fs.writeFileSync(path.join(root, ".gitignore"), "node_modules/\n.worktrees/\nprepared\n");
  fs.writeFileSync(path.join(root, "source"), "stale");
  const scripts = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts;
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      scripts: {
        predev: scripts.predev,
        dev: scripts.dev,
        "predev:local": "node -e \"require('node:fs').writeFileSync('prepared', 'yes')\"",
      },
    }),
  );
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  git(root, "switch", "-qc", "workspace/main");
  const main = path.join(root, ".worktrees/integration");
  const task = path.join(root, ".worktrees/task");
  git(root, "worktree", "add", main, "main");
  fs.writeFileSync(path.join(main, "source"), "latest");
  git(main, "commit", "-qam", "latest source");
  git(root, "worktree", "add", "-b", "agent/task", task, "main");
  fs.writeFileSync(path.join(task, "source"), "task edits");
  for (const checkout of [root, main, task]) {
    const bin = path.join(checkout, "node_modules/vite/bin");
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(
      path.join(bin, "vite.js"),
      `console.log(JSON.stringify({cwd:process.cwd(), source:require('node:fs').readFileSync('source','utf8'), args:process.argv.slice(2)}));`,
    );
  }
  const [command, args] = commandInvocation("npm", ["run", "dev", "--", "--host", "literal & value"]);
  const preview = (cwd: string) =>
    spawnSync(process.execPath, [path.join(cwd, "scripts/dev.mjs"), "serve", "--host", "literal & value"], {
      cwd,
      encoding: "utf8",
      timeout: 3_000,
    });
  const originalHead = git(root, "rev-parse", "HEAD");
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 3_000 });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain(JSON.stringify({ cwd: main, source: "latest", args: ["--host", "literal & value"] }));
  expect(fs.existsSync(path.join(main, "prepared"))).toBe(true);
  expect(fs.existsSync(path.join(root, "prepared"))).toBe(false);
  expect(git(root, "rev-parse", "HEAD")).toBe(originalHead);
  const isolated = preview(task);
  expect(isolated.status, isolated.stderr).toBe(0);
  expect(isolated.stdout).toContain(
    JSON.stringify({ cwd: task, source: "task edits", args: ["--host", "literal & value"] }),
  );
  git(main, "switch", "-qc", "elsewhere");
  const missing = preview(root);
  expect(missing.status).not.toBe(0);
  expect(missing.stderr).toContain("No checkout owns main");
  expect(fs.existsSync(path.join(root, "prepared"))).toBe(false);
});
