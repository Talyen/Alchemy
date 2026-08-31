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
    const child = spawn(command, args, spawnOpts(options));
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    const finish = (status, error) => {
      resolve({
        status,
        error,
        stdout,
        stderr,
        output: collectOutput(stdout, stderr, error),
        elapsedMs: Date.now() - started,
      });
    };
    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(code));
  });
}
