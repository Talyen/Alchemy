import { releaseEdition } from "./game-edition.mjs";
/** Validate configuration before Vite can upload source maps or packaging starts. */
export function validateDesktopBuildConfig(env = process.env) {
  const sentryDsn = env.SENTRY_DSN?.trim() ?? "";
  const uploadFields = [env.SENTRY_AUTH_TOKEN?.trim(), env.SENTRY_ORG?.trim(), env.SENTRY_PROJECT?.trim()];
  const configuredUploadFields = uploadFields.filter(Boolean).length;
  const sentryUploadEnabled = configuredUploadFields === uploadFields.length;
  if (configuredUploadFields > 0 && !sentryUploadEnabled) {
    throw new Error("Sentry source-map configuration is partial; configure token, organization, and project together.");
  }
  if (env.CI_RELEASE === "true" && Boolean(sentryDsn) !== sentryUploadEnabled) {
    throw new Error("Production crash reporting requires both the public DSN and complete source-map upload settings.");
  }
  if (env.CI_RELEASE === "true" && sentryUploadEnabled && env.ALCHEMY_SKIP_SOURCEMAP === "1") {
    throw new Error("Production crash reporting requires source maps; unset ALCHEMY_SKIP_SOURCEMAP.");
  }

  const selected = releaseEdition(env);
  const steamAppId = selected.steamAppId;
  const numericAppId = Number(steamAppId);
  if (
    env.CI_RELEASE === "true" &&
    (!/^\d+$/u.test(steamAppId ?? "") ||
      !Number.isSafeInteger(numericAppId) ||
      numericAppId <= 0 ||
      numericAppId === 480)
  ) {
    throw new Error("CI_RELEASE builds require STEAM_APP_ID to be set to the production Steam App ID (not 480).");
  }
  if (env.CI_RELEASE === "true" && selected.edition === "demo") {
    const fullId = selected.fullGameSteamAppId;
    if (!/^\d+$/u.test(fullId ?? "") || !Number.isSafeInteger(Number(fullId)) || Number(fullId) <= 0 || Number(fullId) === 480 || fullId === steamAppId) {
      throw new Error("Demo releases require distinct production demo and full-game App IDs");
    }
  }
  if (env.CI_RELEASE === "true" && (!/^\d+$/u.test(selected.steamDepotId ?? "") || !Number.isSafeInteger(Number(selected.steamDepotId)) || Number(selected.steamDepotId) <= 0)) {
    throw new Error("Production desktop builds require the selected Steam depot ID");
  }
  const azureFields = {
    publisherName: env.AZURE_CODE_SIGNING_PUBLISHER_NAME?.trim(),
    endpoint: env.AZURE_CODE_SIGNING_ENDPOINT?.trim(),
    codeSigningAccountName: env.AZURE_CODE_SIGNING_ACCOUNT_NAME?.trim(),
    certificateProfileName: env.AZURE_CODE_SIGNING_CERTIFICATE_PROFILE_NAME?.trim(),
  };
  const configuredAzureFields = Object.values(azureFields).filter(Boolean).length;
  if (configuredAzureFields > 0 && configuredAzureFields !== Object.keys(azureFields).length) {
    throw new Error("Azure Trusted Signing configuration is partial; configure all four public signing values.");
  }
  return { sentryDsn, sentryUploadEnabled, steamAppId, azureFields };
}
