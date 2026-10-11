import { releaseEdition, assertPackageEdition } from "./lib/release/game-edition.mjs";
// Runs electron-builder for each target declared in steam/platforms.json.
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSupportedTargets, targetToBuilderFlag } from "./lib/release/desktop-artifact.mjs";
import { runStreamCommand } from "./lib/run-command.mjs";
import { resolveSentryRelease } from "./lib/release/sentry-release.mjs";
import { validateDesktopBuildConfig } from "./lib/release/desktop-build-config.mjs";
import { verifyDesktopRenderer } from "./lib/release/release-checks.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const selected = releaseEdition();
const config = JSON.parse(readFileSync(join(root, "steam/platforms.json"), "utf8"));
const targets = config.targets ?? ["win"];
assertSupportedTargets(targets);
const { sentryDsn, sentryUploadEnabled, steamAppId, azureFields } = validateDesktopBuildConfig();
const sentryRelease = resolveSentryRelease();
if (process.env.CI_RELEASE === "true" && sentryUploadEnabled) {
  const pending = [join(root, selected.rendererDirectory)];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      if (entry.isFile() && entry.name.endsWith(".map")) {
        throw new Error(`Sentry upload completed but a source map was not removed: ${entryPath}`);
      }
    }
  }
}

// Publishing is an explicit release-workflow responsibility. electron-builder
// otherwise infers publishing from CI environment variables.
const packageDir = process.env.ALCHEMY_PACKAGE_DIR === "1" || process.argv.includes("--dir");
const rendererIdentity = JSON.parse(readFileSync(join(root, selected.rendererDirectory, "edition.json"), "utf8"));
assertPackageEdition(
  {
    gameEdition: selected.edition,
    steamAppId,
    steamDepotId: selected.steamDepotId,
    fullGameSteamAppId: selected.fullGameSteamAppId,
  },
  rendererIdentity,
);
verifyDesktopRenderer(join(root, selected.rendererDirectory));
const builderConfig = {
  ...JSON.parse(readFileSync(join(root, "package.json"), "utf8")).build,
  productName: selected.productName,
  appId: selected.appId,
  directories: { output: selected.packageDirectory },
  files: ["desktop/**/*", "game-edition.mjs", `${selected.rendererDirectory}/**/*`, "!**/*.map", "package.json"],
  extraMetadata: {
    gameEdition: selected.edition,
    steamAppId: steamAppId ?? 480,
    steamDepotId: selected.steamDepotId ?? null,
    fullGameSteamAppId: selected.fullGameSteamAppId ?? 480,
  },
};
mkdirSync(join(root, "steam/build"), { recursive: true });
const builderConfigPath = join(root, "steam/build", `electron-${selected.edition}.json`);
writeFileSync(builderConfigPath, JSON.stringify(builderConfig));
const builderArgs = ["--publish", "never"];
builderArgs.push("--config", builderConfigPath);
for (const target of targets) {
  builderArgs.push(targetToBuilderFlag(target));
}
if (packageDir) {
  builderArgs.push("--dir");
  // electron-builder's --dir bypasses target.arch and otherwise uses the host CPU.
  if (targets.includes("win")) builderArgs.push("--x64");
}

if (process.env.CI_RELEASE === "true" && sentryDsn) {
  builderArgs.push(
    "-c.extraMetadata.sentryEnabled=true",
    `-c.extraMetadata.sentryDsn=${sentryDsn}`,
    `-c.extraMetadata.sentryRelease=${sentryRelease}`,
  );
}

if (process.env.CI_RELEASE === "true") {
  builderArgs.push(`-c.extraMetadata.steamAppId=${steamAppId}`);
}
if (azureFields.publisherName) {
  for (const [key, value] of Object.entries(azureFields)) {
    builderArgs.push(`-c.win.azureSignOptions.${key}=${value}`);
  }
}
if (process.env.REQUIRE_CODE_SIGNING === "true") {
  builderArgs.push("-c.forceCodeSigning=true");
}

const result = runStreamCommand("npx", ["electron-builder", ...builderArgs], {
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: "--no-deprecation" },
});

if (result.error) throw result.error;
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

for (const target of targets) {
  const verifyResult = runStreamCommand(process.execPath, ["scripts/verify-desktop-package.mjs"], {
    cwd: root,
    env: { ...process.env, DESKTOP_TARGET: target },
  });
  if (verifyResult.error) throw verifyResult.error;
  if ((verifyResult.status ?? 1) !== 0) process.exit(verifyResult.status ?? 1);
}
