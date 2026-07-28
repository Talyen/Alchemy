const path = require("node:path");
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
