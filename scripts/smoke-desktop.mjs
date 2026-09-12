import { spawnSync } from "node:child_process";
import path from "node:path";
import { executablePath, resolveUnpackedDirectory } from "./lib/desktop-artifact.mjs";

// The shipped fuses disable Node inspection. Use native accessibility instead
// of weakening the package to accommodate Playwright's Electron launcher.
if (process.platform !== "win32") {
  throw new Error("Packaged desktop smoke requires Windows; run it in the desktop-build or release CI job.");
}
const root = path.resolve(import.meta.dirname, "..");
const directory = resolveUnpackedDirectory(path.join(root, "release-desktop"), { target: "win" });
const result = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(root, "scripts/smoke-desktop.ps1"),
    "-Executable",
    executablePath(directory, "win"),
  ],
  { cwd: root, stdio: "inherit", timeout: 90_000 },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
