import { spawn, spawnSync } from "node:child_process";

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
    env: options.env,
    shell: options.shell ?? process.platform === "win32",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    timeout: options.timeout,
  };
}

export function runCommand(command, args = [], options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    ...spawnOpts(options),
    encoding: "utf8",
  });
  return {
    ...result,
    output: collectOutput(result.stdout, result.stderr, result.error),
    elapsedMs: Date.now() - started,
  };
}

/**
 * Async sibling of runCommand for running several bounded commands concurrently
 * (e.g. audit sweeps). Output is captured, never interleaved on the terminal.
 */
export function runCommandAsync(command, args = [], options = {}) {
  const started = Date.now();
  return new Promise((resolve) => {
    const spawnOptions = spawnOpts(options);
    const timeoutMs = typeof spawnOptions.timeout === "number" && spawnOptions.timeout > 0 ? spawnOptions.timeout : 0;
    const childSpawnOpts = { ...spawnOptions };
    if (timeoutMs) delete childSpawnOpts.timeout;
    const child = spawn(command, args, childSpawnOpts);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timeoutHandle;
    if (timeoutMs) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        try {
          child.kill("SIGTERM");
        } catch {}
        setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {}
        }, 2000);
      }, timeoutMs);
      if (timeoutHandle.unref) timeoutHandle.unref();
    }
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    const finish = (status, error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (timedOut && !error) error = new Error(`command timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`);
      resolve({
        status: timedOut ? null : status,
        error,
        stdout,
        stderr,
        output: collectOutput(stdout, stderr, error),
        elapsedMs: Date.now() - started,
        timedOut,
      });
    };
    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(code));
  });
}
