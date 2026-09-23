export function substituteSteamVdf(template: string, values: Record<string, string>): string;

export function writeSteamBuildVdfs(
  root: string,
  env: { STEAM_APP_ID: string; STEAM_DEPOT_ID: string; [key: string]: string },
): { appPath: string; depotPath: string; buildDir: string; contentRoot: string };
