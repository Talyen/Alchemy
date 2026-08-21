import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join, resolve } from "node:path";

import { FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";
import {
  executablePath,
  resolveUnpackedDirectory,
  targetFromUnpackedName,
  targetPlatform,
} from "./lib/desktop-artifact.mjs";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");

const outputRoot = resolve("release-desktop");
const requestedTarget = process.env.DESKTOP_TARGET;
const appDirectory = resolveUnpackedDirectory(outputRoot, { target: requestedTarget });
const target = requestedTarget ?? targetFromUnpackedName(basename(appDirectory));
const artifactPlatform = targetPlatform(target);
const executable = executablePath(appDirectory, target);
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

const packagedMetadata = JSON.parse(asar.extractFile(packagedAsar, "package.json").toString("utf8"));
if (process.env.CI_RELEASE === "true") {
  const bakedAppId = packagedMetadata.steamAppId;
  const parsedAppId = Number.parseInt(String(bakedAppId ?? ""), 10);
  if (!Number.isFinite(parsedAppId) || parsedAppId <= 0) {
    throw new Error("CI_RELEASE package is missing baked steamAppId metadata.");
  }
  if (parsedAppId === 480) {
    throw new Error("CI_RELEASE package must not use Steam App ID 480 (Spacewar).");
  }
}

const asarUnpackedRoot = join(appDirectory, "resources", "app.asar.unpacked");
if (artifactPlatform === "win32") {
  const steamworksWin64 = join(asarUnpackedRoot, "node_modules", "steamworks.js", "dist", "win64");
  const requiredNatives = [
    join(steamworksWin64, "steamworksjs.win32-x64-msvc.node"),
    join(steamworksWin64, "steam_api64.dll"),
  ];
  for (const nativePath of requiredNatives) {
    if (!existsSync(nativePath)) {
      throw new Error(`Steamworks native module is missing from app.asar.unpacked: ${nativePath}`);
    }
  }
} else if (artifactPlatform === "linux") {
  const steamworksLinux = join(asarUnpackedRoot, "node_modules", "steamworks.js", "dist", "linux64");
  if (
    !existsSync(steamworksLinux) ||
    !readdirSync(steamworksLinux).some((name) => name.endsWith(".node") || name.endsWith(".so"))
  ) {
    throw new Error(`Steamworks native module is missing from app.asar.unpacked under ${steamworksLinux}`);
  }
} else if (artifactPlatform === "darwin") {
  const steamworksOsx = join(asarUnpackedRoot, "node_modules", "steamworks.js", "dist", "osx");
  if (
    !existsSync(steamworksOsx) ||
    !readdirSync(steamworksOsx).some((name) => name.endsWith(".node") || name.endsWith(".dylib"))
  ) {
    throw new Error(`Steamworks native module is missing from app.asar.unpacked under ${steamworksOsx}`);
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

console.log(
  "Packaged Electron fuses, ASAR boundary, Steamworks natives, source maps, secrets, and signing state verified.",
);
