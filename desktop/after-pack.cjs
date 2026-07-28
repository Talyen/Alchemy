const path = require("node:path");
const { copyFile } = require("node:fs/promises");
const { glob } = require("node:fs/promises");
const { flipFuses, FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = async function hardenElectronAfterPack(context) {
  const targetPlatform = context.electronPlatformName ?? context.packager.platform.nodeName;
  const executableName =
    targetPlatform === "win32"
      ? `${context.packager.appInfo.productFilename}.exe`
      : context.packager.appInfo.productFilename;
  const executablePath =
    targetPlatform === "darwin"
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents",
          "MacOS",
          context.packager.appInfo.productFilename,
        )
      : path.join(context.appOutDir, executableName);

  // Electron does not ship a browser-specific snapshot. Enabling the fuse
  // without installing one makes the executable abort before JavaScript starts.
  for await (const defaultSnapshot of glob("**/v8_context_snapshot*.bin", {
    cwd: context.appOutDir,
  })) {
    const snapshotDirectory = path.dirname(defaultSnapshot);
    await copyFile(
      path.join(context.appOutDir, defaultSnapshot),
      path.join(context.appOutDir, snapshotDirectory, "browser_v8_context_snapshot.bin"),
    );
  }

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
