const path = require("node:path");
const { copyFile, glob: fsGlob } = require("node:fs/promises");
const { flipFuses, FuseV1Options, FuseVersion } = require("@electron/fuses");
const { executablePathForPackContext } = require("./package-layout.cjs");

async function* fallbackGlob(pattern, options) {
  const { readdir, stat } = require("node:fs/promises");
  const cwd = options?.cwd ?? ".";
  const pending = [""];
  while (pending.length > 0) {
    const relative = pending.pop();
    const absolute = path.join(cwd, relative);
    const entries = await readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      const entryRelative = path.join(relative, entry.name);
      const entryAbsolute = path.join(cwd, entryRelative);
      if (entry.isDirectory()) {
        pending.push(entryRelative);
      } else if (entry.isFile()) {
        const matches = entryRelative === pattern || entryRelative.endsWith(pattern.replace("**/", ""));
        if (matches && entryRelative.includes("v8_context_snapshot")) {
          const s = await stat(entryAbsolute).catch(() => null);
          if (s) yield entryRelative;
        }
      }
    }
  }
}

async function installBrowserProcessSnapshots(appOutDir) {
  const globImpl = typeof fsGlob === "function" ? fsGlob : fallbackGlob;
  for await (const defaultSnapshot of globImpl("**/v8_context_snapshot*.bin", { cwd: appOutDir })) {
    const snapshotDirectory = path.dirname(defaultSnapshot);
    await copyFile(
      path.join(appOutDir, defaultSnapshot),
      path.join(appOutDir, snapshotDirectory, "browser_v8_context_snapshot.bin"),
    );
  }
}

module.exports = async function hardenElectronAfterPack(context) {
  const targetPlatform = context.electronPlatformName ?? context.packager.platform.nodeName;
  const executablePath = executablePathForPackContext(context);

  // Electron does not ship a browser-specific snapshot. Enabling the fuse
  // without installing one makes the executable abort before JavaScript starts.
  await installBrowserProcessSnapshots(context.appOutDir);

  await flipFuses(executablePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    resetAdHocDarwinSignature: targetPlatform === "darwin",
    strictlyRequireAllFuses: true,
  });
};

module.exports.installBrowserProcessSnapshots = installBrowserProcessSnapshots;
module.exports.resolvePackagedExecutable = executablePathForPackContext;
