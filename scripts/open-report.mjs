// Opens a report file with the platform default opener (macOS / Windows / Linux).
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function openReport(relativeOrAbsolutePath) {
  const resolved = path.resolve(rootDir, relativeOrAbsolutePath);

  try {
    await access(resolved);
  } catch {
    throw new Error(`Report file not found: ${resolved}`);
  }

  if (process.platform === "darwin") {
    await execFileAsync("open", [resolved]);
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", resolved], { windowsHide: true });
    return;
  }

  await execFileAsync("xdg-open", [resolved]);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: node scripts/open-report.mjs <file-path>");
  }

  await openReport(filePath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
