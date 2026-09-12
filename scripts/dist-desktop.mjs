// Runs electron-builder for each target declared in steam/platforms.json.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assertSupportedTargets, targetToBuilderFlag } from "./lib/desktop-artifact.mjs";
import { resolveSentryRelease } from "./lib/sentry-release.mjs";
import { validateDesktopBuildConfig } from "./lib/desktop-build-config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "steam/platforms.json"), "utf8"));
const targets = config.targets ?? ["win"];
assertSupportedTargets(targets);
const { sentryDsn, sentryUploadEnabled, steamAppId, azureFields } = validateDesktopBuildConfig();
const sentryRelease = resolveSentryRelease();
if (process.env.CI_RELEASE === "true" && sentryUploadEnabled) {
  const pending = [join(root, "dist")];
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

const builderCli = join(root, "node_modules", "electron-builder", "out", "cli", "cli.js");
// Publishing is an explicit release-workflow responsibility. electron-builder
// otherwise infers publishing from CI environment variables.
const packageDir = process.env.ALCHEMY_PACKAGE_DIR === "1" || process.argv.includes("--dir");
const builderArgs = ["--publish", "never"];
for (const target of targets) {
  builderArgs.push(targetToBuilderFlag(target));
}
if (packageDir) {
  builderArgs.push("--dir");
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

const result = spawnSync(process.execPath, [builderCli, ...builderArgs], {
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: "--no-deprecation" },
  stdio: "inherit",
  shell: false,
});

if (result.error) throw result.error;
if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

for (const target of targets) {
  const verifyResult = spawnSync(process.execPath, ["scripts/verify-desktop-package.mjs"], {
    cwd: root,
    env: { ...process.env, DESKTOP_TARGET: target },
    stdio: "inherit",
    shell: false,
  });
  if (verifyResult.error) throw verifyResult.error;
  if ((verifyResult.status ?? 1) !== 0) process.exit(verifyResult.status ?? 1);
}
