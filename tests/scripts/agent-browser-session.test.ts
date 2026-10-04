import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  closeTaskBrowsers,
  browserSocketDirectory,
  captureBrowser,
  ownedGroups,
  processInfo,
  processRows,
  readRecord,
  registry,
  recoverBrowsers,
  type BrowserRecord,
} from "../../scripts/lib/agent-browser-session.mjs";

function killTestGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

describe.skipIf(process.platform === "win32")("managed browser ownership", () => {
  it("uses the launch socket directory and rejects unverified launch ownership", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "alchemy-browser-missing-"));
    try {
      execFileSync("git", ["init", "-q", directory]);
      vi.stubEnv("XDG_RUNTIME_DIR", directory);
      vi.stubEnv("AGENT_BROWSER_SOCKET_DIR", "");
      expect(browserSocketDirectory()).toBe(path.join(directory, "agent-browser"));
      await expect(captureBrowser("missing", directory, "my-task")).rejects.toThrow(/ownership PID file/);
      await expect(captureBrowser("missing", directory, "my-task", false)).resolves.toBeUndefined();
      expect(await readRecord(path.join(await registry(directory), "missing.json"))).toBeNull();
    } finally {
      vi.unstubAllEnvs();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("cleans recorded group members after their leader exits", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "alchemy-browser-orphan-"));
    execFileSync("git", ["init", "-q", directory]);
    const leader = spawn(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(() => {}, 1000)'],{stdio:'ignore'}); console.log(child.pid); setInterval(() => {}, 1000);",
      ],
      { detached: true, stdio: ["ignore", "pipe", "ignore"] },
    );
    const exit = once(leader, "exit");
    try {
      const [output] = await once(leader.stdout!, "data");
      const childPid = Number(String(output).trim());
      const owner = (await processInfo(leader.pid!))!;
      const member = (await processInfo(childPid))!;
      expect(member.group).toBe(owner.pid);
      const store = await registry(directory);
      await mkdir(store);
      const file = path.join(store, "orphan.json");
      await writeFile(
        file,
        JSON.stringify({
          task: "my-task",
          daemon: owner,
          session: "owned",
          closed: false,
          groups: [{ pid: owner.pid, started: owner.started, members: [{ pid: childPid, started: member.started }] }],
        }),
      );
      leader.kill("SIGKILL");
      await exit;
      expect(await processInfo(childPid)).not.toBeNull();
      await closeTaskBrowsers(directory, "my-task");
      expect(await processInfo(childPid)).toBeNull();
      expect((await readRecord(file))?.closed).toBe(true);
    } finally {
      killTestGroup(leader.pid!);
      await exit;
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("recovers orphaned groups but preserves live owners, other tasks and reused process identities", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "alchemy-browser-"));
    execFileSync("git", ["init", "-q", directory]);
    const processes = Array.from({ length: 4 }, () =>
      spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" }),
    );
    const exits = processes.map((process) => once(process, "exit"));
    try {
      const groups = await Promise.all(
        processes.map(async (process) => ({ pid: process.pid!, started: (await processInfo(process.pid!))!.started })),
      );
      const store = await registry(directory);
      await mkdir(store);
      const record = (index: number, task: string, ownerStarted = groups[index].started): BrowserRecord => ({
        task,
        daemon: { ...groups[index], started: ownerStarted },
        groups: [groups[index]],
        session: task,
        closed: false,
      });
      await writeFile(path.join(store, "orphan.json"), JSON.stringify(record(0, "finished", "exited daemon")));
      await writeFile(path.join(store, "active.json"), JSON.stringify(record(1, "other-task")));
      await writeFile(path.join(store, "own.json"), JSON.stringify(record(2, "my-task")));
      await writeFile(
        path.join(store, "reused.json"),
        JSON.stringify({ ...record(3, "my-task"), groups: [{ ...groups[3], started: "reused PID" }] }),
      );
      await recoverBrowsers(directory);
      await exits[0];
      expect(await processInfo(groups[1].pid)).not.toBeNull();
      await closeTaskBrowsers(directory, "my-task");
      await exits[2];
      expect(await processInfo(groups[1].pid)).not.toBeNull();
      expect(await processInfo(groups[3].pid)).not.toBeNull();
      expect((await readRecord(path.join(store, "own.json")))?.closed).toBe(true);
    } finally {
      for (const process of processes)
        if (process.exitCode === null && process.signalCode === null) process.kill("SIGKILL");
      await Promise.all(exits);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("records only independently owned descendants of the selected daemon", () => {
    const rows = processRows(
      "10 1 10 Sat Oct 3 10:29:06 2026 S /bin/agent-browser\n20 10 20 Sat Oct 3 10:29:07 2026 S Chrome\n21 20 20 Sat Oct 3 10:29:08 2026 S Renderer\n30 1 30 Sat Oct 3 10:29:09 2026 S OtherChrome",
    );
    expect(ownedGroups(rows, 10).map((group) => group.pid)).toEqual([10, 20]);
    expect(ownedGroups(rows, 10)[1].members?.map((member) => member.pid)).toEqual([20, 21]);
    expect(() => ownedGroups(rows, 30)).toThrow(/ownership/);
  });

  it("preserves ownership when ps reports an inspection error instead of a missing process", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "alchemy-browser-query-"));
    try {
      execFileSync("git", ["init", "-q", directory]);
      const store = await registry(directory);
      await mkdir(store);
      const owner = (await processInfo(process.pid))!;
      const file = path.join(store, "active.json");
      await writeFile(
        file,
        JSON.stringify({
          task: "active",
          daemon: owner,
          groups: [{ pid: owner.pid, started: owner.started }],
          closed: false,
        }),
      );
      await writeFile(path.join(directory, "ps"), "#!/bin/sh\necho inspection-failed >&2\nexit 1\n", { mode: 0o755 });
      const module = new URL("../../scripts/lib/agent-browser-session.mjs", import.meta.url).href;
      const code = `import assert from 'node:assert/strict'; import {recoverBrowsers} from ${JSON.stringify(module)}; await assert.rejects(recoverBrowsers(${JSON.stringify(directory)}));`;
      execFileSync(process.execPath, ["--input-type=module", "-e", code], {
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      });
      expect((await readRecord(file))?.closed).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
