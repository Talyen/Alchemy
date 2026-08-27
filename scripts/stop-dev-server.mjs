// Stops a stale project-owned Vite server so dev always reuses the same localStorage origin.
// Depends on OS process inspection; it refuses to kill unrelated processes on the dev port.
// Windows uses PowerShell net/CIM APIs; macOS/Linux use lsof + ps with the same ownership guard.
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { isMainModule } from "./lib/is-main-module.mjs";
import { parsePort, resolveDevPort } from "./lib/dev-port.mjs";

const execFileAsync = promisify(execFile);
const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const UNIX_STOP_GRACE_MS = 1_500;

function normalizePathForMatch(value, platform) {
  const withPlatformSeparators = platform === "win32" ? value.replaceAll("/", "\\") : value;
  return platform === "win32" ? withPlatformSeparators.toLowerCase() : withPlatformSeparators;
}

export function isProjectOwnedCommandLine(commandLine, projectRoot, platform = process.platform) {
  const separator = platform === "win32" ? "\\" : "/";
  const normalizedCommand = normalizePathForMatch(commandLine, platform);
  const normalizedRoot = normalizePathForMatch(projectRoot, platform).replace(/[\\/]+$/u, "");

  let offset = normalizedCommand.indexOf(normalizedRoot);
  while (offset !== -1) {
    const before = offset === 0 ? "" : normalizedCommand[offset - 1];
    const after = normalizedCommand[offset + normalizedRoot.length] ?? "";
    const startsAtBoundary = offset === 0 || /[\s"'=]/u.test(before);
    const endsAtBoundary = after === "" || after === separator || /[\s"']/u.test(after);
    if (startsAtBoundary && endsAtBoundary) return true;
    offset = normalizedCommand.indexOf(normalizedRoot, offset + 1);
  }
  return false;
}

async function runPowerShell(command) {
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    windowsHide: true,
  });
  return stdout.trim();
}

async function getWindowsListeningPids(port) {
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

export async function stopOwnedListeners({
  port,
  projectRoot,
  platform,
  getListeningPids,
  getCommandLine,
  stopPid,
  log = console.log,
}) {
  const pids = await getListeningPids(port);
  if (pids.length === 0) {
    log(`No project-owned dev server found on port ${port}.`);
    return;
  }

  let stoppedAny = false;
  let ownedFound = false;

  for (const pid of pids) {
    const commandLine = await getCommandLine(pid);
    if (!commandLine) continue;
    if (!isProjectOwnedCommandLine(commandLine, projectRoot, platform)) {
      log(`Port ${port} is used by PID ${pid}, but it is not from this project. Leaving it running.`);
      continue;
    }

    ownedFound = true;
    log(`Stopping stale dev server PID ${pid} on port ${port}.`);
    await stopPid(pid);
    stoppedAny = true;
  }

  if (stoppedAny) return;
  // Distinguish "no owned listeners" from "owned listeners vanished between lsof and ps"
  if (!ownedFound) log(`No project-owned dev server found on port ${port}.`);
}

async function getUnixListeningPids(port) {
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
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
    return stdout.trim();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 1) {
      return "";
    }
    throw error;
  }
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

export async function stopDevServer({ port = resolveDevPort(), projectRoot = rootDir } = {}) {
  const validatedPort = parsePort(port, "port");

  if (process.platform === "win32") {
    await stopOwnedListeners({
      port: validatedPort,
      projectRoot,
      platform: process.platform,
      getListeningPids: getWindowsListeningPids,
      getCommandLine: getWindowsCommandLine,
      stopPid: stopWindowsPid,
    });
    return;
  }

  if (process.platform === "darwin" || process.platform === "linux") {
    await stopOwnedListeners({
      port: validatedPort,
      projectRoot,
      platform: process.platform,
      getListeningPids: getUnixListeningPids,
      getCommandLine: getUnixCommandLine,
      stopPid: stopUnixPid,
    });
    return;
  }

  console.log(`Dev server auto-stop is not implemented for ${process.platform}; relying on Vite strictPort.`);
}

if (isMainModule(import.meta.url)) {
  stopDevServer().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
