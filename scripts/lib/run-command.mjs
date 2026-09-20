import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { commandInvocation } from "./command-invocation.mjs";
import { createRunId } from "./current-run.mjs";
import { completionCounts, failureSummary } from "./compact-output.mjs";

const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;
const activeCommands = new Set();

function stopActiveCommands(signal) {
  for (const stop of activeCommands) stop();
  process.exit(signal === "SIGINT" ? 130 : 143);
}

const onInterrupt = () => stopActiveCommands("SIGINT");
const onTerminate = () => stopActiveCommands("SIGTERM");

function openCapture(options) {
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer < 1024)
    throw new Error("maxBuffer must be an integer of at least 1024 bytes");
  if (!options.logPath) return { maxBuffer, finish: () => ({}) };
  const logPath = path.resolve(options.cwd ?? process.cwd(), options.logPath);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const fd = fs.openSync(logPath, "w+");
  return {
    maxBuffer,
    stdio: ["ignore", fd, fd],
    finish() {
      try {
        const outputBytes = fs.fstatSync(fd).size;
        const outputTruncated = outputBytes > maxBuffer;
        let output;
        if (outputTruncated) {
          const half = Math.floor(maxBuffer / 2);
          const head = Buffer.alloc(half);
          fs.readSync(fd, head, 0, half, 0);
          const tail = Buffer.alloc(half);
          fs.readSync(fd, tail, 0, half, outputBytes - half);
          output = head.toString("utf8") + `\n[...output omitted; full log: ${logPath}...]\n` + tail.toString("utf8");
        } else {
          const head = Buffer.alloc(outputBytes);
          fs.readSync(fd, head, 0, outputBytes, 0);
          output = head.toString("utf8");
        }
        return { output, outputBytes, outputTruncated, logPath };
      } finally {
        fs.closeSync(fd);
      }
    },
  };
}

/**
 * Run a bounded command and return one normalized captured-output record.
 * Callers own the user-facing summary and diagnostic artifact policy.
 */
function collectOutput(stdout, stderr, error) {
  return [stdout ?? "", stderr ?? "", error?.message ?? ""].filter(Boolean).join("\n");
}

function spawnOpts(options) {
  return {
    cwd: options.cwd,
    env: options.logPath ? { ...(options.env ?? process.env), ALCHEMY_OUTPUT_CAPTURED: "1" } : options.env,
    shell: options.shell ?? false,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    timeout: options.timeout,
  };
}

export function runCommand(command, args = [], options = {}) {
  const started = Date.now();
  const invocation = commandInvocation(command, args);
  const capture = openCapture(options);
  const result = spawnSync(...invocation, {
    ...spawnOpts(options),
    ...(capture.stdio ? { stdio: capture.stdio } : {}),
    maxBuffer: capture.maxBuffer,
    encoding: "utf8",
  });
  const captured = capture.finish();
  return {
    ...result,
    ...captured,
    output: collectOutput(captured.output ?? result.stdout, result.stderr, result.error),
    elapsedMs: Date.now() - started,
  };
}

/**
 * Streaming sibling of runCommand for long-running CLIs (builds, ship suites,
 * browser runs, profiling) where operators need live progress.
 * Resolves the tool through commandInvocation (no shell, no npx download),
 * streams stdio inherit, and returns the raw spawn result. Use this instead of
 * raw spawnSync so CLI resolution stays in one owner; bounded capture stays in
 * runCommand/runCommandAsync for gates that digest output.
 */
export function runStreamCommand(command, args = [], options = {}) {
  const started = Date.now();
  const invocation = commandInvocation(command, args);
  const unsupported = ["timeout", "shell", "stdio", "logPath", "maxBuffer"].filter((key) => options[key] !== undefined);
  if (unsupported.length > 0) {
    throw new Error(`runStreamCommand does not support option(s): ${unsupported.join(", ")}`);
  }
  const result = spawnSync(...invocation, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    stdio: "inherit",
    encoding: "utf8",
  });
  return { ...result, elapsedMs: Date.now() - started };
}

/**
 * Run a one-shot command without allowing routine output to flood the caller.
 * The complete stream is retained in a log; callers receive a small status
 * summary and actionable failure excerpt. Pass live=true for interactive use.
 */
export async function runTaskCommand(command, args = [], options = {}) {
  const {
    cwd = process.cwd(),
    label = command,
    live = false,
    logPath = path.join(cwd, "reports", "compact", createRunId("command"), "output.log"),
    ...runnerOptions
  } = options;
  if (live) return runStreamCommand(command, args, { cwd, ...runnerOptions });
  const result = await runCommandAsync(command, args, { cwd, ...runnerOptions, logPath });
  const status = result.status ?? 1;
  const counts = completionCounts(result.output);
  if (counts) console.log(counts);
  if (status !== 0) console.error(failureSummary(result.output));
  console.log(`${status === 0 ? "PASS" : "FAIL"} ${label} (exit ${status}, ${(result.elapsedMs / 1000).toFixed(1)}s)`);
  console.log(`Full log: ${path.relative(cwd, logPath)}`);
  return result;
}

/**
 * Async sibling of runCommand for running several bounded commands concurrently
 * (e.g. audit sweeps). Output is captured, never interleaved on the terminal.
 */
export function runCommandAsync(command, args = [], options = {}) {
  const started = Date.now();
  const invocation = commandInvocation(command, args);
  const capture = openCapture(options);
  return new Promise((resolve) => {
    const spawnOptions = { ...spawnOpts(options), ...(capture.stdio ? { stdio: capture.stdio } : {}) };
    const timeoutMs = typeof spawnOptions.timeout === "number" && spawnOptions.timeout > 0 ? spawnOptions.timeout : 0;
    // A dedicated POSIX process group lets a deadline stop npm's descendants
    // even when its immediate child has already exited. Windows uses taskkill /T.
    const childSpawnOpts = { ...spawnOptions, detached: process.platform !== "win32" };
    if (timeoutMs) delete childSpawnOpts.timeout;
    const child = spawn(...invocation, childSpawnOpts);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timeoutHandle;
    let spawnError;
    let bufferError;
    let capturedBytes = 0;
    const stopTree = () => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        const killed = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          timeout: 5_000,
          encoding: "utf8",
        });
        if (killed.error) spawnError ??= killed.error;
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") spawnError ??= error;
        }
      }
    };
    activeCommands.add(stopTree);
    if (activeCommands.size === 1) {
      process.on("SIGINT", onInterrupt);
      process.on("SIGTERM", onTerminate);
    }
    if (timeoutMs) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        stopTree();
      }, timeoutMs);
      if (timeoutHandle.unref) timeoutHandle.unref();
    }
    const collect = (chunk, stderrChunk) => {
      capturedBytes += chunk.length;
      if (capturedBytes > capture.maxBuffer) {
        if (!bufferError) {
          bufferError = new Error(`Command output exceeded ${capture.maxBuffer} bytes; use logPath for file capture`);
          stopTree();
        }
        return;
      }
      if (stderrChunk) stderr += chunk;
      else stdout += chunk;
    };
    child.stdout?.on("data", (chunk) => collect(chunk, false));
    child.stderr?.on("data", (chunk) => collect(chunk, true));
    const finish = (status, error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      activeCommands.delete(stopTree);
      if (activeCommands.size === 0) {
        process.off("SIGINT", onInterrupt);
        process.off("SIGTERM", onTerminate);
      }
      error ??= spawnError ?? bufferError;
      const captured = capture.finish();
      if (timedOut && !error) error = new Error(`command timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`);
      resolve({
        ...captured,
        status: timedOut || error ? null : status,
        error,
        stdout,
        stderr,
        output: collectOutput(captured.output ?? stdout, stderr, error),
        elapsedMs: Date.now() - started,
        timedOut,
      });
    };
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code) => finish(code));
  });
}
