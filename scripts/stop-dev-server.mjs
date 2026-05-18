// Stops a stale project-owned Vite server so dev always reuses the same localStorage origin.
// Depends on OS process inspection; it refuses to kill unrelated processes on the dev port.
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const port = Number.parseInt(process.env.ALCHEMY_DEV_PORT ?? "5173", 10);

function normalizePathForMatch(value) {
  return value.replaceAll("/", "\\").toLowerCase();
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

async function main() {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ALCHEMY_DEV_PORT: ${process.env.ALCHEMY_DEV_PORT}`);
  }

  if (process.platform !== "win32") {
    console.log("Dev server auto-stop is only implemented for Windows; relying on Vite strictPort.");
    return;
  }

  await stopWindowsDevServer();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
