import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { resolveEdition, editionPolicy } = require("../../../game-edition.mjs");

export function releaseEdition(env = process.env) {
  const edition = resolveEdition(env.ALCHEMY_EDITION);
  const policy = editionPolicy(edition);
  return {
    ...policy,
    steamAppId: (edition === "demo" ? env.STEAM_DEMO_APP_ID : env.STEAM_APP_ID)?.trim(),
    steamDepotId: (edition === "demo" ? env.STEAM_DEMO_DEPOT_ID : env.STEAM_DEPOT_ID)?.trim(),
    fullGameSteamAppId: env.STEAM_APP_ID?.trim(),
  };
}

export function assertPackageEdition(metadata, renderer, env = process.env) {
  const expected = releaseEdition(env);
  if (metadata.gameEdition !== expected.edition || renderer.edition !== expected.edition) {
    throw new Error("Package, renderer and selected edition must match");
  }
  if (expected.steamAppId && String(metadata.steamAppId) !== expected.steamAppId) {
    throw new Error("Package Steam App ID differs from the selected upload/build target");
  }
  if (expected.steamDepotId && String(metadata.steamDepotId) !== expected.steamDepotId) {
    throw new Error("Package Steam depot differs from the selected upload target");
  }
  if (expected.fullGameSteamAppId && String(metadata.fullGameSteamAppId) !== expected.fullGameSteamAppId) {
    throw new Error("Package wishlist App ID differs from the full game");
  }
}
