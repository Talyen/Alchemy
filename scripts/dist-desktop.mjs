// Runs electron-builder for each target declared in steam/platforms.json.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "steam/platforms.json"), "utf8"));
const targets = config.targets ?? ["win"];
const sentryDsn = process.env.SENTRY_DSN?.trim() ?? "";
const releaseVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const sentryRelease = process.env.SENTRY_RELEASE?.trim() || `alchemy@${releaseVersion}`;
const sentryUploadFields = [
  process.env.SENTRY_AUTH_TOKEN?.trim(),
  process.env.SENTRY_ORG?.trim(),
  process.env.SENTRY_PROJECT?.trim(),
];
const configuredSentryUploadFields = sentryUploadFields.filter(Boolean);
if (configuredSentryUploadFields.length > 0 && configuredSentryUploadFields.length !== sentryUploadFields.length) {
  throw new Error("Sentry source-map configuration is partial; configure token, organization, and project together.");
}
if (
  process.env.CI_RELEASE === "true" &&
  Boolean(sentryDsn) !== (configuredSentryUploadFields.length === sentryUploadFields.length)
) {
  throw new Error("Production crash reporting requires both the public DSN and complete source-map upload settings.");
}
if (process.env.CI_RELEASE === "true" && configuredSentryUploadFields.length === sentryUploadFields.length) {
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
const builderArgs = ["--publish", "never"];
for (const target of targets) {
  if (target === "win") builderArgs.push("--win");
  if (target === "linux") builderArgs.push("--linux");
  if (target === "mac") builderArgs.push("--mac");
}

if (process.env.CI_RELEASE === "true" && sentryDsn) {
  builderArgs.push(
    "-c.extraMetadata.sentryEnabled=true",
    `-c.extraMetadata.sentryDsn=${sentryDsn}`,
    `-c.extraMetadata.sentryRelease=${sentryRelease}`,
  );
}
const azureFields = {
  publisherName: process.env.AZURE_CODE_SIGNING_PUBLISHER_NAME?.trim(),
  endpoint: process.env.AZURE_CODE_SIGNING_ENDPOINT?.trim(),
  codeSigningAccountName: process.env.AZURE_CODE_SIGNING_ACCOUNT_NAME?.trim(),
  certificateProfileName: process.env.AZURE_CODE_SIGNING_CERTIFICATE_PROFILE_NAME?.trim(),
};
const configuredAzureFields = Object.values(azureFields).filter(Boolean);
if (configuredAzureFields.length > 0 && configuredAzureFields.length !== Object.keys(azureFields).length) {
  throw new Error("Azure Trusted Signing configuration is partial; configure all four public signing values.");
}
if (configuredAzureFields.length > 0) {
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

const verifyResult = spawnSync(process.execPath, ["scripts/verify-desktop-package.mjs"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: false,
});
if (verifyResult.error) throw verifyResult.error;
process.exit(verifyResult.status ?? 1);
