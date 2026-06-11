// Substitutes Steam VDF template placeholders and writes build artifacts for steamcmd.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function substituteSteamVdf(template, env) {
  const buildOutput = (env.BUILD_OUTPUT ?? "").replaceAll("\\", "/");
  return template
    .replaceAll("${STEAM_APP_ID}", env.STEAM_APP_ID ?? "0")
    .replaceAll("${STEAM_DEPOT_ID}", env.STEAM_DEPOT_ID ?? "0")
    .replaceAll("${BUILD_OUTPUT}", buildOutput);
}

export function writeSteamBuildVdfs(root, env) {
  const buildDir = join(root, "steam", "build");
  mkdirSync(buildDir, { recursive: true });

  const buildOutput = join(root, "release-desktop");
  const resolvedEnv = {
    STEAM_APP_ID: env.STEAM_APP_ID ?? "0",
    STEAM_DEPOT_ID: env.STEAM_DEPOT_ID ?? "0",
    BUILD_OUTPUT: buildOutput,
  };

  const depotTemplate = readFileSync(join(root, "steam", "depot_build.vdf"), "utf8");
  const appTemplate = readFileSync(join(root, "steam", "app_build.vdf"), "utf8");

  const depotPath = join(buildDir, "depot_build.vdf");
  const appPath = join(buildDir, "app_build.vdf");

  writeFileSync(depotPath, substituteSteamVdf(depotTemplate, resolvedEnv), "utf8");
  writeFileSync(
    appPath,
    substituteSteamVdf(appTemplate, resolvedEnv).replace(
      '"steam/depot_build.vdf"',
      `"${depotPath.replaceAll("\\", "/")}"`,
    ),
    "utf8",
  );

  return { appPath, depotPath, buildDir };
}
