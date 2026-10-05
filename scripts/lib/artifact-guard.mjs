import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const GUARD_PORT = 48158;

function guardDirectory(rootDir) {
  const root = fs.realpathSync(rootDir);
  const key = crypto.createHash("sha256").update(root).digest("hex").slice(0, 24);
  return path.join(os.tmpdir(), `alchemy-artifacts-${key}`);
}

function ownerAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

async function acquireMutex() {
  const deadline = Date.now() + 2_000;
  for (;;) {
    const server = net.createServer((socket) => socket.destroy());
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port: GUARD_PORT, exclusive: true }, resolve);
      });
      // The OS releases this mutex on owner termination; no stale lock recovery
      // can race a new owner or require terminating an unrelated listener.
      return () =>
        new Promise((resolve) => {
          server.close(resolve);
        });
    } catch (error) {
      if (error.code !== "EADDRINUSE" || Date.now() >= deadline)
        throw new Error("Artifact cleanup coordination is busy; no artifacts were removed.", { cause: error });
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    }
  }
}

function activeOwners(directory, dryRun) {
  const stats = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!stats) return false;
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("Unsafe artifact guard directory");
  let active = false;
  for (const name of fs.readdirSync(directory)) {
    const match = /^(\d+)-[a-f0-9-]+\.lease$/u.exec(name);
    if (!match || ownerAlive(Number(match[1]))) active = true;
    else if (!dryRun) fs.unlinkSync(path.join(directory, name));
  }
  return active;
}

/** Serialize registration and deletion across participating processes. */
export async function withArtifactGuard(rootDir, operation, { dryRun = false } = {}) {
  const release = await acquireMutex();
  try {
    const directory = guardDirectory(rootDir);
    return operation({ active: activeOwners(directory, dryRun), directory });
  } finally {
    await release();
  }
}

/** Keep the whole transient tree in use, including silent/long-running servers. */
export async function registerArtifactSession(rootDir, prune) {
  return withArtifactGuard(rootDir, ({ directory }) => {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const lease = path.join(directory, `${process.pid}-${crypto.randomUUID()}.lease`);
    fs.writeFileSync(lease, "", { flag: "wx", mode: 0o600 });
    const release = () => {
      fs.rmSync(lease, { force: true });
      process.removeListener("exit", release);
      if (prune) process.removeListener("beforeExit", onIdle);
    };
    const onIdle = async () => {
      release();
      try {
        await withArtifactGuard(rootDir, ({ active }) => {
          if (!active) prune();
        });
      } catch (error) {
        console.error(error.message);
        process.exitCode ||= 1;
      }
    };
    process.once("exit", release);
    if (prune) process.once("beforeExit", onIdle);
    return release;
  });
}
