import { describe, expect, it, vi } from "vitest";
import { isProjectOwnedCommandLine, stopOwnedListeners } from "../../scripts/stop-dev-server.mjs";

describe("isProjectOwnedCommandLine", () => {
  const projectRoot = "/Users/dev/Alchemy";

  it("matches commands running from within the project root", () => {
    expect(isProjectOwnedCommandLine(`node ${projectRoot}/node_modules/vite/bin/vite.js`, projectRoot, "darwin")).toBe(
      true,
    );
    expect(isProjectOwnedCommandLine(`node --root=${projectRoot}`, projectRoot, "linux")).toBe(true);
  });

  it("does not match a sibling whose name starts with the project root", () => {
    expect(
      isProjectOwnedCommandLine(`node ${projectRoot}-copy/node_modules/vite/bin/vite.js`, projectRoot, "darwin"),
    ).toBe(false);
  });

  it("treats nested managed worktrees as separate process owners", () => {
    const worktree = `${projectRoot}/.worktrees/task`;
    const command = `node ${worktree}/node_modules/vite/bin/vite.js`;
    expect(isProjectOwnedCommandLine(command, projectRoot, "darwin")).toBe(false);
    expect(isProjectOwnedCommandLine(command, worktree, "darwin")).toBe(true);
    expect(
      isProjectOwnedCommandLine(
        `node ${projectRoot}/node_modules/vite/bin/vite.js --config ${worktree}/vite.config.ts`,
        projectRoot,
        "darwin",
      ),
    ).toBe(false);
    expect(
      isProjectOwnedCommandLine(
        String.raw`node C:\Alchemy\.worktrees\task\node_modules\vite\bin\vite.js`,
        String.raw`C:\Alchemy`,
        "win32",
      ),
    ).toBe(false);
  });

  it("uses platform-appropriate path casing and separators", () => {
    expect(isProjectOwnedCommandLine("node /users/dev/alchemy/vite.js", projectRoot, "linux")).toBe(false);
    expect(
      isProjectOwnedCommandLine(
        String.raw`node C:\USERS\DEV\ALCHEMY\node_modules\vite\bin\vite.js`,
        String.raw`C:/Users/Dev/Alchemy`,
        "win32",
      ),
    ).toBe(true);
  });
});

it("stopOwnedListeners stops only listeners owned by this project", async () => {
  const stopPid = vi.fn(async () => undefined);
  const log = vi.fn();
  const commandLines = new Map([
    [11, "node /workspace/Alchemy/node_modules/vite/bin/vite.js"],
    [12, "node /workspace/Alchemy-copy/node_modules/vite/bin/vite.js"],
    [13, ""],
    [14, "node /workspace/Alchemy/.worktrees/another-task/node_modules/vite/bin/vite.js"],
  ]);

  await stopOwnedListeners({
    port: 4173,
    projectRoot: "/workspace/Alchemy",
    platform: "linux",
    getListeningPids: async () => [11, 12, 13, 14],
    getCommandLine: async (pid) => commandLines.get(pid) ?? "",
    stopPid,
    log,
  });

  expect(stopPid).toHaveBeenCalledExactlyOnceWith(11);
  expect(log).toHaveBeenCalledWith(expect.stringContaining("PID 12"));
});
