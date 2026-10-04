import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const launcher = path.join(ROOT, "scripts/agent-browser.mjs");
const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
export function taskKey(env = process.env) {
  const id = env.CODEX_THREAD_ID ?? env.CODEX_SESSION_ID;
  return id ? createHash("sha256").update(id).digest("hex").slice(0, 20) : null;
}
export function browserSocketDirectory(env = process.env) {
  return (
    env.AGENT_BROWSER_SOCKET_DIR ||
    (env.XDG_RUNTIME_DIR ? path.join(env.XDG_RUNTIME_DIR, "agent-browser") : path.join(homedir(), ".agent-browser"))
  );
}
export async function registry(root = ROOT) {
  const { stdout } = await execute("git", ["rev-parse", "--git-common-dir"], { cwd: root });
  return path.resolve(root, stdout.trim(), "agent-browsers");
}
export async function readRecord(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function save(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, file);
}
export function processRows(output) {
  return output.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d{4})\s+(\S+)\s+(.+)$/u);
    return match
      ? [
          {
            pid: Number(match[1]),
            parent: Number(match[2]),
            group: Number(match[3]),
            started: match[4],
            state: match[5],
            command: match[6],
          },
        ]
      : [];
  });
}
export async function processInfo(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Invalid recorded browser PID");
  try {
    const { stdout } = await execute("ps", ["-p", String(pid), "-o", "pid=,ppid=,pgid=,lstart=,stat=,comm="]);
    const info = processRows(stdout)[0];
    if (stdout.trim() && !info) throw new Error("Process identity output could not be verified");
    return info?.state.startsWith("Z") ? null : (info ?? null);
  } catch (error) {
    if (error.code === 1 && !error.stderr?.trim() && !error.stdout?.trim()) return null;
    throw error;
  }
}
export function ownedGroups(rows, daemonPid) {
  const daemon = rows.find((row) => row.pid === daemonPid);
  if (!daemon || !daemon.command.includes("agent-browser") || daemon.group !== daemonPid)
    throw new Error("Browser daemon ownership could not be verified");
  const descendants = new Set([daemonPid]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const row of rows)
      if (descendants.has(row.parent) && !descendants.has(row.pid)) {
        descendants.add(row.pid);
        changed = true;
      }
  }
  return rows
    .filter((row) => descendants.has(row.pid) && row.group === row.pid)
    .map(({ pid, started }) => ({
      pid,
      started,
      members: rows
        .filter((row) => descendants.has(row.pid) && row.group === pid && !row.state.startsWith("Z"))
        .map((row) => ({ pid: row.pid, started: row.started })),
    }));
}
async function matches(group) {
  // A dead leader does not mean its group has exited. Match a recorded member
  // before signaling the group, so survivors are cleaned without trusting a reused PID.
  for (const member of [{ pid: group.pid, started: group.started }, ...(group.members ?? [])]) {
    const info = await processInfo(member.pid);
    if (info && info.group === group.pid && info.started === member.started) return true;
  }
  return false;
}
export async function stopSession(file) {
  const record = await readRecord(file);
  if (!record || record.closed) return;
  if (!Array.isArray(record.groups) || record.groups.some((group) => !group.started))
    throw new Error("Incomplete browser ownership record; preserve it");
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    for (const group of record.groups)
      if (await matches(group)) {
        try {
          process.kill(-group.pid, signal);
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
    for (let attempt = 0; attempt < 20; attempt++) {
      if (!(await Promise.all(record.groups.map(matches))).some(Boolean)) {
        await save(file, { ...record, closed: true });
        return;
      }
      await delay(100);
    }
  }
  throw new Error("Browser cleanup did not finish; retained its ownership record");
}
async function records(root) {
  const directory = await registry(root);
  const names = await readdir(directory).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  return Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const file = path.join(directory, name);
        return { file, record: await readRecord(file) };
      }),
  );
}
export async function closeTaskBrowsers(root = ROOT, key = taskKey()) {
  if (!key || process.platform === "win32") return;
  for (const { file, record } of await records(root))
    if (record?.task === key && !record.closed) await stopSession(file);
}
export async function recoverBrowsers(root = ROOT) {
  for (const { file, record } of await records(root)) {
    if (!record || record.closed) continue;
    const owner = await processInfo(record.daemon.pid);
    if (!owner || owner.started !== record.daemon.started) await stopSession(file);
  }
}
export async function captureBrowser(session, root = ROOT, key = taskKey(), required = true) {
  const directory = await registry(root);
  await mkdir(directory, { recursive: true });
  const socketDir = browserSocketDirectory();
  const pidFile = path.join(socketDir, `${session}.pid`);
  let pid;
  try {
    pid = Number((await readFile(pidFile, "utf8")).trim());
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!required) return;
      throw new Error("Browser ownership PID file is missing; cleanup cannot be verified", { cause: error });
    }
    throw error;
  }
  const { stdout } = await execute("ps", ["-axo", "pid=,ppid=,pgid=,lstart=,stat=,comm="]);
  const groups = ownedGroups(processRows(stdout), pid);
  const daemon = groups.find((group) => group.pid === pid);
  const file = path.join(
    directory,
    `${key}-${pid}-${createHash("sha256").update(daemon.started).digest("hex").slice(0, 12)}.json`,
  );
  const previous = await readRecord(file);
  const combined = new Map((previous?.groups ?? []).map((group) => [`${group.pid}:${group.started}`, group]));
  for (const group of groups) {
    const identity = `${group.pid}:${group.started}`;
    const members = new Map(
      [...(combined.get(identity)?.members ?? []), ...group.members].map((member) => [
        `${member.pid}:${member.started}`,
        member,
      ]),
    );
    combined.set(identity, { ...group, members: [...members.values()] });
  }
  const record = { task: key, daemon, groups: [...combined.values()], session, closed: false };
  await save(file, record);
  if (previous?.guardian && (await processInfo(previous.guardian.pid))?.started === previous.guardian.started) {
    await save(file, { ...record, guardian: previous.guardian });
    return;
  }
  const child = spawn(process.execPath, [launcher, "--watch", file], { detached: true, stdio: "ignore" });
  child.unref();
  const guardian = await processInfo(child.pid);
  if (!guardian) throw new Error("Browser guardian did not start; preserve the session record");
  await save(file, { ...record, guardian: { pid: child.pid, started: guardian.started } });
}
export async function watchBrowser(file) {
  for (;;) {
    const record = await readRecord(file);
    if (!record || record.closed) return;
    const owner = await processInfo(record.daemon.pid);
    if (!owner || owner.started !== record.daemon.started) {
      await stopSession(file);
      return;
    }
    await delay(5000);
  }
}
