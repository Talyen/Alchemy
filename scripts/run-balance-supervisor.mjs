import { performance } from "node:perf_hooks";
import { spawn, execFileSync } from "node:child_process";
import { closeSync, fstatSync, mkdirSync, openSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
if (process.env.ALCHEMY_ALLOW_HEAVY_LOCAL !== "1")
  throw new Error("An explicitly authorized local sweep requires ALCHEMY_ALLOW_HEAVY_LOCAL=1");
if (
  process.env.ALCHEMY_BALANCE_SHARD_COUNT ||
  process.env.ALCHEMY_BALANCE_SHARD_INDEX ||
  process.env.ALCHEMY_BALANCE_MERGE_DIR
)
  throw new Error("The local supervisor requires an unsharded checkpoint");
const checkpoint = resolve(root, process.env.ALCHEMY_BALANCE_CHECKPOINT ?? "reports/balance-batches");
const commonDir = resolve(
  root,
  execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" }).trim(),
);
const lane = process.env.ALCHEMY_HEAVY_LANE ?? resolve(dirname(commonDir), "..", ".coordination/heavy_lane.py");
const owner = process.env.ALCHEMY_BALANCE_OWNER ?? `balance-supervisor-${process.pid}`;
mkdirSync(checkpoint, { recursive: true });
const lockPath = resolve(checkpoint, ".supervisor.lock");
let lock;
try {
  lock = openSync(lockPath, "wx");
} catch (error) {
  if (error.code === "EEXIST")
    throw new Error(`Supervisor is locked: ${lockPath}. Verify its owner before recovery.`, { cause: error });
  throw error;
}
writeFileSync(lock, JSON.stringify({ pid: process.pid, owner }));
function release() {
  if (lock === undefined) return;
  const owned = fstatSync(lock);
  closeSync(lock);
  lock = undefined;
  try {
    const current = statSync(lockPath);
    if (current.dev === owned.dev && current.ino === owned.ino) unlinkSync(lockPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
process.once("exit", release);
function checkpointProgress(dir) {
  let progress = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) progress += checkpointProgress(path);
    else if (entry.isFile() && entry.name.endsWith(".json")) {
      const stat = statSync(path);
      progress += `${path}:${stat.size}:${stat.mtimeMs};`;
    }
  }
  return progress;
}
let child;
let stopped = false;
let lastTimeoutProgress;
let unchangedTimeouts = 0;
const abort = new globalThis.AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stopped = true;
    abort.abort();
    child?.kill(signal);
  });

while (!stopped) {
  let complete = false;
  let outputTail = "";
  let admissionRecorded = false;
  const queueStarted = performance.now();
  child = spawn(
    "python3",
    [
      lane,
      "--owner",
      owner,
      "--wait",
      "900",
      "--timeout",
      "300",
      "--",
      process.execPath,
      "scripts/run-balance-batches.mjs",
    ],
    {
      cwd: root,
      env: { ...process.env, ALCHEMY_BALANCE_BATCH_GROUPS: "1000000", ALCHEMY_BALANCE_BATCH_MS: "240000" },
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    outputTail = (outputTail + chunk.toString()).slice(-500);
    if (!admissionRecorded && outputTail.includes("Heavy lane admitted")) {
      console.info(`[balance timings] laneWaitMs=${Math.round(performance.now() - queueStarted)}`);
      admissionRecorded = true;
    }
    if (outputTail.includes("Balance report complete:")) complete = true;
  });
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (status, signal) => resolveExit(status ?? (signal ? 128 : 1)));
  });
  child = undefined;
  if (stopped) break;
  if (code === 0 && complete) break;
  if (code === 75) {
    console.info(`[balance timings] laneWaitMs=${Math.round(performance.now() - queueStarted)}`);
    console.info("Heavy lane admission expired; retrying in five minutes.");
    try {
      await delay(300000, undefined, { signal: abort.signal });
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    }
  } else if (code === 124) {
    const progress = checkpointProgress(checkpoint);
    unchangedTimeouts = progress === lastTimeoutProgress ? unchangedTimeouts + 1 : 0;
    lastTimeoutProgress = progress;
    if (unchangedTimeouts >= 2)
      throw new Error("Three batch timeouts without checkpoint progress; investigation required");
    console.error("Batch timed out; retrying with the same deadline and checkpoint.");
  } else if (code !== 0) {
    throw new Error(`Balance batch failed with exit status ${code}; checkpoint preserved`);
  } else {
    unchangedTimeouts = 0;
    lastTimeoutProgress = undefined;
  }
}
if (stopped) process.exitCode = 130;
