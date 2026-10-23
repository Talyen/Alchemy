import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { acquireExclusivePort } from "../exclusive-port.mjs";
import { unitSelection } from "./unit-selection.mjs";

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
  if (args[0] === "scripts/run-unit-batch.mjs") return true;
  const tool = command
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.(?:cmd|exe)$/u, "");
  return tool === "vitest" || tool === "playwright" || (tool === "npx" && ["vitest", "playwright"].includes(args[0]));
}

// A broad run retains the existing lane. One explicitly focused unit run gets
// a separate one-worker reservation; directories, related and coverage stay broad.
export function testResourceClass(command, args) {
  const tool = command
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.(?:cmd|exe)$/u, "");
  if (tool !== "vitest" || args[0] !== "run") return "broad";
  return unitSelection(args).focused ? "focused" : "broad";
}

const STATUS_DIRECTORY = path.join(
  os.tmpdir(),
  `alchemy-test-resources-${process.getuid?.() ?? os.userInfo().username}`,
);

function ownsTicket(record) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: record.leasePort });
    let response = "";
    const finish = (live) => {
      socket.destroy();
      resolve(live);
    };
    socket.setTimeout(1_000, () => finish(false));
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.once("end", () => finish(response === record.ticket));
    socket.once("error", () => finish(false));
  });
}

export async function acquireTestResources(
  command,
  args,
  cwd,
  { directory = STATUS_DIRECTORY, broadPort = LOCAL_TEST_PORT, focusedPort = LOCAL_TEST_PORT + 1, ...options } = {},
) {
  const kind = testResourceClass(command, args);
  const port = kind === "focused" ? focusedPort : broadPort;
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(
    directory,
    `${process.hrtime.bigint().toString().padStart(24, "0")}-${process.pid}-${randomUUID()}.json`,
  );
  const record = {
    ticket: path.basename(filename),
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
  let lane;
  let lease;
  let watcher;
  try {
    // A PID may be reused after a crash. The private listener proves that the
    // waiting process still owns this exact ticket; the OS releases it on exit.
    lease = await acquireExclusivePort(0, {
      signal: options.signal,
      label: "Test reservation lease",
      onConnection: (socket) => socket.end(record.ticket),
    });
    record.leasePort = lease.port;
    let change = new AbortController();
    watcher = fs.watch(directory, { persistent: false }, () => change.abort());
    watcher.on("error", () => {
      watcher.close();
      change.abort();
    });
    write();
    lane = await acquireExclusivePort(port, {
      ...options,
      label: `Local ${kind} test lane`,
      // Releases wake the queue immediately; polling still covers crashed owners.
      wait: async (ms, signal) => {
        const observed = change;
        try {
          await delay(ms, undefined, { signal: signal ? AbortSignal.any([signal, observed.signal]) : observed.signal });
        } catch (error) {
          signal?.throwIfAborted();
          if (!observed.signal.aborted) throw error;
        } finally {
          if (observed.signal.aborted && change === observed) change = new AbortController();
        }
      },
      // Legacy clients still respect the exclusive listener. Queue ordering
      // applies to clients with leases, without trusting stale legacy records.
      canAcquire: async () => {
        const waiters = testResourceStatus(directory)
          .filter(
            (entry) =>
              entry.state === "waiting" &&
              entry.port === port &&
              Number.isInteger(entry.leasePort) &&
              entry.leasePort > 0 &&
              entry.leasePort < 65536 &&
              typeof entry.ticket === "string",
          )
          .sort((a, b) => a.ticket.localeCompare(b.ticket));
        for (const entry of waiters) {
          if (await ownsTicket(entry)) return entry.ticket === record.ticket;
        }
        return false;
      },
    });
    watcher.close();
    record.port = lane.port;
    record.state = "active";
    write();
  } catch (error) {
    watcher?.close();
    await lane?.release();
    await lease?.release();
    fs.rmSync(filename, { force: true });
    throw error;
  }
  return {
    kind,
    release: async () => {
      try {
        await lane.release();
      } finally {
        await lease.release();
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
        // Liveness here is advisory; queue admission also checks the ticket lease.
        process.kill(record.pid, 0);
        return [record];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.since.localeCompare(b.since) || (a.ticket ?? "").localeCompare(b.ticket ?? ""));
}
