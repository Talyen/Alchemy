import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronRoot = path.join(projectRoot, "node_modules", "electron");
const pathMarkerFile = path.join(projectRoot, "test-results", ".electron-executable-path");
const MIN_BINARY_BYTES = 10_000_000;

export function platformPath() {
  switch (process.platform) {
    case "win32":
      return "electron.exe";
    case "linux":
    case "freebsd":
    case "openbsd":
      return "electron";
    case "darwin":
    case "mas":
      return "Electron.app/Contents/MacOS/Electron";
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

export function getExecutablePath(relativePath = platformPath()) {
  const overrideDist = process.env.ELECTRON_OVERRIDE_DIST_PATH;
  if (overrideDist) {
    return path.join(overrideDist, relativePath);
  }

  return path.join(electronRoot, "dist", relativePath);
}

export function resolveElectronExecutablePath() {
  const pathFile = path.join(electronRoot, "path.txt");
  const relativePath = fs.existsSync(pathFile)
    ? fs.readFileSync(pathFile, "utf8").trim() || platformPath()
    : platformPath();

  return getExecutablePath(relativePath);
}

export function isElectronInstalled() {
  const executablePath = resolveElectronExecutablePath();

  try {
    const stat = fs.statSync(executablePath);
    return stat.isFile() && stat.size > MIN_BINARY_BYTES;
  } catch {
    return false;
  }
}

export function writeExecutablePathMarker(executablePath = resolveElectronExecutablePath()) {
  fs.mkdirSync(path.dirname(pathMarkerFile), { recursive: true });
  fs.writeFileSync(pathMarkerFile, executablePath, "utf8");
}

export { electronRoot, MIN_BINARY_BYTES, projectRoot };
