// Stops a stale project-owned Vite server so dev always reuses the same localStorage origin.
// Depends on OS process inspection; it refuses to kill unrelated processes on the dev port.
// Windows uses PowerShell net/CIM APIs; macOS/Linux use lsof + ps with the same ownership guard.
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const execFileAsync = promisify(execFile);
const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const port = Number.parseInt(process.env.ALCHEMY_DEV_PORT ?? "5173", 10);
const UNIX_STOP_GRACE_MS = 1_500;

function normalizePathForMatch(value) {
  const withPlatformSeparators = process.platform === "win32" ? value.replaceAll("/", "\\") : value;
  return withPlatformSeparators.toLowerCase();
}

async function runPowerShell(command) {
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    windowsHide: true,
  });
  return stdout.trim();
}

async function getWindowsListeningPids() {
  const output = await runPowerShell(
    `$connections = @(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue); ` +
      `$connections | Select-Object -ExpandProperty OwningProcess -Unique | ConvertTo-Json; exit 0`,
  );
  if (!output) return [];
  const parsed = JSON.parse(output);
  return (Array.isArray(parsed) ? parsed : [parsed]).filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function getWindowsCommandLine(pid) {
  return runPowerShell(
    `$process = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"; ` +
      `if ($process) { $process.CommandLine }; exit 0`,
  );
}

async function stopWindowsPid(pid) {
  await execFileAsync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
}

async function stopWindowsDevServer() {
  const pids = await getWindowsListeningPids();
  if (pids.length === 0) return;

  const normalizedRoot = normalizePathForMatch(rootDir);
  let stoppedAny = false;

  for (const pid of pids) {
    const commandLine = await getWindowsCommandLine(pid);
    if (!normalizePathForMatch(commandLine).includes(normalizedRoot)) {
      console.log(`Port ${port} is used by PID ${pid}, but it is not from this project. Leaving it running.`);
      continue;
    }

    console.log(`Stopping stale dev server PID ${pid} on port ${port}.`);
    await stopWindowsPid(pid);
    stoppedAny = true;
  }

  if (stoppedAny) return;
  console.log(`No project-owned dev server found on port ${port}.`);
}

async function getUnixListeningPids() {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
    return stdout
      .trim()
      .split(/\n+/)
      .map((line) => Number.parseInt(line, 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch (error) {
    // lsof exits non-zero when nothing is listening on the port.
    if (error && typeof error === "object" && "code" in error && error.code === 1) {
      return [];
    }
    throw error;
  }
}

async function getUnixCommandLine(pid) {
  const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
  return stdout.trim();
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopUnixPid(pid) {
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") {
      return;
    }
    throw error;
  }

  const deadline = Date.now() + UNIX_STOP_GRACE_MS;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return;
    await delay(100);
  }

  if (!isPidAlive(pid)) return;

  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") {
      return;
    }
    throw error;
  }
}

async function stopUnixDevServer() {
  const pids = await getUnixListeningPids();
  if (pids.length === 0) {
    console.log(`No project-owned dev server found on port ${port}.`);
    return;
  }

  const normalizedRoot = normalizePathForMatch(rootDir);
  let stoppedAny = false;

  for (const pid of pids) {
    const commandLine = await getUnixCommandLine(pid);
    if (!normalizePathForMatch(commandLine).includes(normalizedRoot)) {
      console.log(`Port ${port} is used by PID ${pid}, but it is not from this project. Leaving it running.`);
      continue;
    }

    console.log(`Stopping stale dev server PID ${pid} on port ${port}.`);
    await stopUnixPid(pid);
    stoppedAny = true;
  }

  if (stoppedAny) return;
  console.log(`No project-owned dev server found on port ${port}.`);
}

async function main() {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ALCHEMY_DEV_PORT: ${process.env.ALCHEMY_DEV_PORT}`);
  }

  if (process.platform === "win32") {
    await stopWindowsDevServer();
    return;
  }

  if (process.platform === "darwin" || process.platform === "linux") {
    await stopUnixDevServer();
    return;
  }

  console.log(`Dev server auto-stop is not implemented for ${process.platform}; relying on Vite strictPort.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
