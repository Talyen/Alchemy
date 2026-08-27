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

describe("stopOwnedListeners", () => {
  it("stops only listeners owned by this project", async () => {
    const stopPid = vi.fn(async () => undefined);
    const log = vi.fn();
    const commandLines = new Map([
      [11, "node /workspace/Alchemy/node_modules/vite/bin/vite.js"],
      [12, "node /workspace/Alchemy-copy/node_modules/vite/bin/vite.js"],
      [13, ""],
    ]);

    await stopOwnedListeners({
      port: 4173,
      projectRoot: "/workspace/Alchemy",
      platform: "linux",
      getListeningPids: async () => [11, 12, 13],
      getCommandLine: async (pid) => commandLines.get(pid) ?? "",
      stopPid,
      log,
    });

    expect(stopPid).toHaveBeenCalledOnce();
    expect(stopPid).toHaveBeenCalledWith(11);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("PID 12"));
  });

  it("reports when no listeners exist", async () => {
    const log = vi.fn();
    await stopOwnedListeners({
      port: 4173,
      projectRoot: "/workspace/Alchemy",
      platform: "linux",
      getListeningPids: async () => [],
      getCommandLine: async () => "",
      stopPid: async () => undefined,
      log,
    });
    expect(log).toHaveBeenCalledWith("No project-owned dev server found on port 4173.");
  });
});
