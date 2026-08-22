import { readdirSync } from "node:fs";
import path from "node:path";

const TARGET_PREFIXES = Object.freeze({ win: "win", linux: "linux", mac: "mac" });

export function targetPlatform(target) {
  if (target === "win") return "win32";
  if (target === "linux") return "linux";
  if (target === "mac") return "darwin";
  throw new Error(`Unsupported desktop target: ${target}`);
}

function unpackedDirectoryName(target) {
  if (!(target in TARGET_PREFIXES)) throw new Error(`Unsupported desktop target: ${target}`);
  return `${TARGET_PREFIXES[target]}-unpacked`;
}

export function assertSupportedTargets(targets) {
  for (const target of targets) unpackedDirectoryName(target);
}

export function targetFromUnpackedName(name) {
  const target = Object.keys(TARGET_PREFIXES).find((key) => name.startsWith(TARGET_PREFIXES[key]));
  if (!target) throw new Error(`Unsupported unpacked directory name: ${name}`);
  return target;
}

/** electron-builder qualifies some targets with an arch suffix (mac-arm64-unpacked). */
function unpackedDirectoryMatches(name, target) {
  return name === unpackedDirectoryName(target) || name.startsWith(`${TARGET_PREFIXES[target]}-`);
}

export function resolveUnpackedDirectory(outputRoot, { target } = {}) {
  const entries = readdirSync(outputRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("-unpacked"))
    .filter((entry) => !target || unpackedDirectoryMatches(entry.name, target));
  if (entries.length === 0) {
    throw new Error(
      target
        ? `No unpacked Electron application for target ${target} was found under ${outputRoot}.`
        : `No unpacked Electron application was found under ${outputRoot}. Specify a target when multiple artifacts exist.`,
    );
  }
  if (entries.length > 1) {
    throw new Error(
      `Multiple unpacked Electron applications found under ${outputRoot}: ${entries.map(({ name }) => name).join(", ")}. Specify DESKTOP_TARGET.`,
    );
  }
  return path.join(outputRoot, entries[0].name);
}

export function executablePath(appDirectory, target) {
  if (target === "win") return path.join(appDirectory, "Alchemy.exe");
  if (target === "mac") return path.join(appDirectory, "Alchemy.app", "Contents", "MacOS", "Alchemy");
  if (target === "linux") return path.join(appDirectory, "alchemy");
  throw new Error(`Unsupported desktop target: ${target}`);
}

export function steamContentRoot(root) {
  return path.join(root, "release-desktop", unpackedDirectoryName("win"));
}
