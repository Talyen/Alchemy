import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { acquireExclusivePort } from "../exclusive-port.mjs";

const LOCAL_TEST_PORT = 48157;

// A loopback listener gives all checkouts on this host one expensive-test lane.
// The OS releases it when its owner exits, without stale files or PID cleanup.
export function acquireLocalTestLane(port = LOCAL_TEST_PORT, options = {}) {
  return acquireExclusivePort(port, { ...options, label: "Local test lane" });
}

export function isInteractiveTestCommand(args) {
  return args.some((arg) => /^(?:--(?:watch|ui|debug)|-w)(?:=(?!false$|0$).*)?$/u.test(arg));
}

export function usesLocalTestLane(command, args) {
  if (isInteractiveTestCommand(args)) return false;
  const tool = command
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.(?:cmd|exe)$/u, "");
  return tool === "vitest" || tool === "playwright" || (tool === "npx" && ["vitest", "playwright"].includes(args[0]));
}

// A broad run retains the existing lane. One explicitly focused unit run gets
// a separate one-worker reservation; directories, related and coverage stay broad.
export function testResourceClass(command, args) {
  const tool = path.basename(command).replace(/\.(?:cmd|exe)$/u, "");
  if (tool !== "vitest" || args[0] !== "run") return "broad";
  const files = args.slice(1);
  return files.length >= 1 &&
    files.length <= 2 &&
    files.every((arg) => /\.test\.tsx?$/u.test(arg) && !arg.startsWith("-"))
    ? "focused"
    : "broad";
}

const STATUS_DIRECTORY = path.join(
  os.tmpdir(),
  `alchemy-test-resources-${process.getuid?.() ?? os.userInfo().username}`,
);

export async function acquireTestResources(
  command,
  args,
  cwd,
  { directory = STATUS_DIRECTORY, broadPort = LOCAL_TEST_PORT, focusedPort = LOCAL_TEST_PORT + 1, ...options } = {},
) {
  const kind = testResourceClass(command, args);
  const port = kind === "focused" ? focusedPort : broadPort;
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, `${process.pid}-${randomUUID()}.json`);
  const record = {
    pid: process.pid,
    cwd,
    kind,
    port,
    command: [command, ...args],
    since: new Date().toISOString(),
    state: "waiting",
  };
  const write = () => {
    const temporary = `${filename}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 });
    fs.renameSync(temporary, filename);
  };
  write();
  let lane;
  try {
    lane = await acquireExclusivePort(port, { ...options, label: `Local ${kind} test lane` });
    record.port = lane.port;
    record.state = "active";
    write();
  } catch (error) {
    await lane?.release();
    fs.rmSync(filename, { force: true });
    throw error;
  }
  return {
    kind,
    release: async () => {
      try {
        await lane.release();
      } finally {
        fs.rmSync(filename, { force: true });
      }
    },
  };
}

export function testResourceStatus(directory = STATUS_DIRECTORY) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      try {
        const record = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
        if (
          !Number.isInteger(record.pid) ||
          record.pid <= 0 ||
          typeof record.since !== "string" ||
          typeof record.cwd !== "string" ||
          !Array.isArray(record.command) ||
          record.command.some((arg) => typeof arg !== "string") ||
          !["active", "waiting"].includes(record.state) ||
          !["focused", "broad"].includes(record.kind)
        )
          return [];
        // Status files never own a lock. Ignore dead processes without reclaiming
        // listeners or deleting another process's records.
        process.kill(record.pid, 0);
        return [record];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.since.localeCompare(b.since));
}
