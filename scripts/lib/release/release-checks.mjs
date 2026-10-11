import { releaseEdition, assertPackageEdition } from "./game-edition.mjs";
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readdirSync, readSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join, posix, resolve } from "node:path";

import { FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";
import {
  browserSnapshotDirectories,
  executablePath,
  resolveUnpackedDirectory,
  targetFromUnpackedName,
  targetPlatform,
} from "./desktop-artifact.mjs";
import { REPO_ROOT } from "../repository-paths.mjs";

const require = createRequire(import.meta.url);

function verifyRendererResources(html, readResource) {
  const resources = [];
  let hasScript = false;
  for (const [tag, element] of html.matchAll(/<(script|link)\b[^>]*>/giu)) {
    const attribute = (name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "iu"))?.[1];
    const script = element.toLowerCase() === "script";
    if (!script && !["stylesheet", "modulepreload"].includes(attribute("rel")?.toLowerCase())) continue;
    const reference = attribute(script ? "src" : "href");
    if (!reference) continue;
    hasScript ||= script;
    resources.push(reference);
  }
  if (!hasScript) throw new Error("Desktop renderer HTML must reference an application script.");
  for (const reference of new Set(resources)) {
    if (/^(?:[\\/]|[a-z][a-z\d+.-]*:)/iu.test(reference)) {
      throw new Error(`Desktop renderer resources must be relative: ${reference} (run npm run build:desktop).`);
    }
    const url = new URL(reference, "file:///renderer/index.html");
    const resource = posix.relative("/renderer", decodeURIComponent(url.pathname));
    if (resource === ".." || resource.startsWith("../")) {
      throw new Error(`Desktop renderer resource points outside the renderer: ${reference}`);
    }
    let bytes;
    try {
      bytes = readResource(resource);
    } catch (cause) {
      throw new Error(`Desktop renderer resource is missing: ${resource}`, { cause });
    }
    if (bytes.length === 0) throw new Error(`Desktop renderer resource is empty: ${resource}`);
  }
}

// Vite copies public files unchanged. Check the copy rather than only the
// source inventory: a renderer can load successfully while its audio is absent.
function verifyPublicAssets(publicDirectory, readResource) {
  const files = readdirSync(publicDirectory, { recursive: true })
    .filter((file) => statSync(join(publicDirectory, file)).isFile())
    .map((file) => file.replaceAll("\\", "/"))
    .sort();
  if (!files.some((file) => file.startsWith("Music/") && file.endsWith(".mp3"))) {
    throw new Error("No authored music found for package verification.");
  }
  for (const file of files) {
    const expected = readFileSync(join(publicDirectory, file));
    let actual;
    try {
      actual = readResource(file);
    } catch (cause) {
      throw new Error(`Renderer public asset is missing: ${file}`, { cause });
    }
    if (!actual.equals(expected)) throw new Error(`Renderer public asset differs from authored output: ${file}`);
  }
}

/** Reject web or incomplete renderer output before packaging or signing it. */
export function verifyDesktopRenderer(rendererDirectory, publicDirectory = join(REPO_ROOT, "public")) {
  verifyRendererResources(readFileSync(join(rendererDirectory, "index.html"), "utf8"), (resource) =>
    readFileSync(join(rendererDirectory, resource)),
  );
  verifyPublicAssets(publicDirectory, (resource) => readFileSync(join(rendererDirectory, resource)));
}

/** Steamworks ships a Windows x64 native binding, regardless of the build host. */
export function verifyWindowsExecutableArchitecture(executable) {
  const fd = openSync(executable, "r");
  try {
    const dos = Buffer.alloc(64);
    if (readSync(fd, dos, 0, dos.length, 0) !== dos.length || dos.toString("ascii", 0, 2) !== "MZ") {
      throw new Error(`Invalid Windows PE executable: ${executable}`);
    }
    const offset = dos.readUInt32LE(0x3c);
    const pe = Buffer.alloc(24);
    if (
      offset < dos.length ||
      readSync(fd, pe, 0, pe.length, offset) !== pe.length ||
      pe.readUInt32LE(0) !== 0x00004550
    ) {
      throw new Error(`Invalid Windows PE header: ${executable}`);
    }
    const machine = pe.readUInt16LE(4);
    if (machine !== 0x8664) {
      throw new Error(
        `Windows executable must be x64 for Steamworks; found PE machine 0x${machine.toString(16)}: ${executable}`,
      );
    }
  } finally {
    closeSync(fd);
  }
}

/** Inspect the artifact itself, including assets that JavaScript imports cannot validate. */
export function verifyPackagedRenderer(archivePath, publicDirectory = join(REPO_ROOT, "public"), rendererDirectory = "dist") {
  const asar = require("@electron/asar");
  const entries = asar.listPackage(archivePath).map((entry) => entry.replaceAll("\\", "/").replace(/^\//u, ""));
  if (entries.some((entry) => entry.endsWith(".map"))) {
    throw new Error("Source maps were found inside app.asar.");
  }
  const indexEntry = `${rendererDirectory}/index.html`;
  if (!entries.includes(indexEntry)) throw new Error(`Packaged renderer is missing ${indexEntry}.`);
  verifyRendererResources(asar.extractFile(archivePath, indexEntry).toString("utf8"), (resource) =>
    asar.extractFile(archivePath, `${rendererDirectory}/${resource}`),
  );
  verifyPublicAssets(publicDirectory, (resource) => asar.extractFile(archivePath, `${rendererDirectory}/${resource}`));
}

/** Throw when a release git tag does not match the package.json version. */
export function verifyReleaseVersionTag(tag, version) {
  if (!tag) throw new Error("RELEASE_TAG or GITHUB_REF_NAME is required");
  const expected = `v${version}`;
  if (tag !== expected) {
    throw new Error(`Release tag ${tag} does not match package.json version ${version} (expected ${expected})`);
  }
  return expected;
}

/** Verify packaged desktop integrity: fuses, ASAR boundary, natives, secrets, signing. */
export async function verifyDesktopPackage() {
  const asar = require("@electron/asar");
  const selected = releaseEdition();
  const outputRoot = resolve(selected.packageDirectory);
  const requestedTarget = process.env.DESKTOP_TARGET;
  const appDirectory = resolveUnpackedDirectory(outputRoot, { target: requestedTarget });
  const target = requestedTarget ?? targetFromUnpackedName(basename(appDirectory));
  const artifactPlatform = targetPlatform(target);
  const executable = executablePath(appDirectory, target, { productFilename: selected.productName });
  if (!existsSync(executable)) throw new Error(`Packaged executable is missing: ${executable}`);
  if (artifactPlatform === "win32") verifyWindowsExecutableArchitecture(executable);

  const snapshotDirectories = browserSnapshotDirectories(appDirectory, target, { productFilename: selected.productName });
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
  verifyPackagedRenderer(packagedAsar, undefined, selected.rendererDirectory);
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
  const rendererIdentity = JSON.parse(asar.extractFile(packagedAsar, `${selected.rendererDirectory}/edition.json`).toString("utf8"));
  assertPackageEdition(packagedMetadata, rendererIdentity);
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
    "Packaged renderer, public assets, Electron fuses, ASAR boundary, Steamworks natives, source maps, secrets, and signing state verified.",
  );
}
