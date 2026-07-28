import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";

const outputRoot = resolve("release-desktop");
const unpackedDirectory = readdirSync(outputRoot, { withFileTypes: true }).find(
  (entry) => entry.isDirectory() && entry.name.endsWith("-unpacked"),
);
if (!unpackedDirectory) throw new Error("No unpacked Electron application was found.");

const appDirectory = join(outputRoot, unpackedDirectory.name);
const artifactPlatform = unpackedDirectory.name.startsWith("win")
  ? "win32"
  : unpackedDirectory.name.startsWith("linux")
    ? "linux"
    : "darwin";
const executable =
  artifactPlatform === "win32"
    ? join(appDirectory, "Alchemy.exe")
    : artifactPlatform === "darwin"
      ? join(appDirectory, "Alchemy.app", "Contents", "MacOS", "Alchemy")
      : join(appDirectory, "alchemy");
if (!existsSync(executable)) throw new Error(`Packaged executable is missing: ${executable}`);

const snapshotDirectories =
  artifactPlatform === "darwin"
    ? [
        join(
          appDirectory,
          "Alchemy.app",
          "Contents",
          "Frameworks",
          "Electron Framework.framework",
          "Versions",
          "A",
          "Resources",
        ),
      ]
    : [appDirectory];
if (
  !snapshotDirectories.some(
    (directory) =>
      existsSync(directory) &&
      readdirSync(directory).some((name) => name.startsWith("browser_v8_context_snapshot") && name.endsWith(".bin")),
  )
) {
  throw new Error("The browser-process V8 snapshot required by the enabled fuse is missing.");
}

const wire = await getCurrentFuseWire(executable);
const requiredFuses = new Map([
  [FuseV1Options.RunAsNode, FuseState.DISABLE],
  [FuseV1Options.EnableCookieEncryption, FuseState.ENABLE],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE],
  [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE],
  [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.ENABLE],
  [FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.DISABLE],
]);
for (const [fuse, expected] of requiredFuses) {
  if (wire[fuse] !== expected) throw new Error(`Electron fuse ${fuse} was ${wire[fuse]}; expected ${expected}.`);
}

const packagedAsar = join(appDirectory, "resources", "app.asar");
if (!existsSync(packagedAsar)) throw new Error("Packaged application is not stored in app.asar.");
if (readdirSync(appDirectory).some((name) => name.endsWith(".map"))) {
  throw new Error("Source maps were found beside the packaged executable.");
}
const packageBytes = readFileSync(packagedAsar);
for (const secretName of ["SENTRY_AUTH_TOKEN", "AZURE_CLIENT_SECRET"]) {
  const value = process.env[secretName];
  if (value && packageBytes.includes(Buffer.from(value))) {
    throw new Error(`${secretName} was embedded in app.asar.`);
  }
}

if (artifactPlatform === "win32" && process.platform === "win32" && process.env.AZURE_CODE_SIGNING_ENDPOINT) {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$signature = Get-AuthenticodeSignature -LiteralPath '${executable.replaceAll("'", "''")}'; if ($signature.Status -ne 'Valid') { throw "Invalid executable signature: $($signature.Status)" }`,
    ],
    { stdio: "inherit" },
  );
}

console.log("Packaged Electron fuses, ASAR boundary, source maps, secrets, and signing state verified.");
