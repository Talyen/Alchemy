const path = require("node:path");
const { readdirSync } = require("node:fs");

const TARGET_PREFIXES = Object.freeze({ win: "win", linux: "linux", mac: "mac" });

function targetPlatform(target) {
  if (target === "win") return "win32";
  if (target === "linux") return "linux";
  if (target === "mac") return "darwin";
  throw new Error(`Unsupported desktop target: ${target}`);
}

function unpackedDirectoryName(target) {
  if (!(target in TARGET_PREFIXES)) throw new Error(`Unsupported desktop target: ${target}`);
  return `${TARGET_PREFIXES[target]}-unpacked`;
}

function assertSupportedTargets(targets) {
  for (const target of targets) unpackedDirectoryName(target);
}

function targetFromUnpackedName(name) {
  const target = Object.keys(TARGET_PREFIXES).find((key) => name.startsWith(TARGET_PREFIXES[key]));
  if (!target) throw new Error(`Unsupported unpacked directory name: ${name}`);
  return target;
}

function unpackedDirectoryMatches(name, target) {
  return name === unpackedDirectoryName(target) || name.startsWith(`${TARGET_PREFIXES[target]}-`);
}

function resolveUnpackedDirectory(outputRoot, { target } = {}) {
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

function executablePath(appDirectory, target, { productFilename = "Alchemy", linuxExecutableName = "alchemy" } = {}) {
  if (target === "win") return path.join(appDirectory, `${productFilename}.exe`);
  if (target === "mac") return path.join(appDirectory, `${productFilename}.app`, "Contents", "MacOS", productFilename);
  if (target === "linux") return path.join(appDirectory, linuxExecutableName);
  throw new Error(`Unsupported desktop target: ${target}`);
}

function executablePathForPackContext(context) {
  const platform = context.electronPlatformName ?? context.packager.platform.nodeName;
  const productFilename = context.packager.appInfo.productFilename;
  if (platform === "win32") return executablePath(context.appOutDir, "win", { productFilename });
  if (platform === "darwin") return executablePath(context.appOutDir, "mac", { productFilename });
  if (platform === "linux") {
    const linuxExecutableName = context.packager.executableName;
    if (!linuxExecutableName) throw new Error("Linux desktop packaging context is missing executableName.");
    return executablePath(context.appOutDir, "linux", { productFilename, linuxExecutableName });
  }
  throw new Error(`Unsupported Electron platform: ${platform}`);
}

function browserSnapshotDirectories(appDirectory, target, { productFilename = "Alchemy" } = {}) {
  if (target === "mac") {
    return [
      path.join(
        appDirectory,
        `${productFilename}.app`,
        "Contents",
        "Frameworks",
        "Electron Framework.framework",
        "Versions",
        "A",
        "Resources",
      ),
    ];
  }
  targetPlatform(target);
  return [appDirectory];
}

module.exports = {
  assertSupportedTargets,
  browserSnapshotDirectories,
  executablePath,
  executablePathForPackContext,
  resolveUnpackedDirectory,
  targetFromUnpackedName,
  targetPlatform,
  unpackedDirectoryName,
};
