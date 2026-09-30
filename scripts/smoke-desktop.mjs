import { releaseEdition } from "./lib/release/game-edition.mjs";
import path from "node:path";
import { executablePath, resolveUnpackedDirectory } from "./lib/release/desktop-artifact.mjs";
import { runStreamCommand } from "./lib/run-command.mjs";
import { defineScript } from "./lib/script-run.mjs";

const root = path.resolve(import.meta.dirname, "..");

export function runSmokeDesktop(rootDir = root) {
  // The shipped fuses disable Node inspection. Use native accessibility instead
  // of weakening the package to accommodate Playwright's Electron launcher.
  if (process.platform !== "win32") {
    throw new Error("Packaged desktop smoke requires Windows; run it in the desktop-build or release CI job.");
  }
  const directory = resolveUnpackedDirectory(path.join(rootDir, releaseEdition().packageDirectory), { target: "win" });
  const result = runStreamCommand(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(rootDir, "scripts/smoke-desktop.ps1"),
      "-Executable",
      executablePath(directory, "win", { productFilename: releaseEdition().productName }),
    ],
    { cwd: rootDir, timeout: 90_000 },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

defineScript(import.meta.url, () => runSmokeDesktop());
