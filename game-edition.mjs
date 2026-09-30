// Shared by Vite, Electron and release tooling; packaged alongside the app.
function resolveEdition(value = "full") {
  if (value !== "demo" && value !== "full") throw new Error(`Invalid Alchemy edition: ${value}`);
  return value;
}
function editionPolicy(edition) {
  const demo = resolveEdition(edition) === "demo";
  return {
    edition,
    productName: demo ? "Alchemy Demo" : "Alchemy",
    appId: demo ? "com.alchemy.game.demo" : "com.alchemy.game",
    rendererDirectory: demo ? "dist-demo" : "dist",
    packageDirectory: demo ? "release-desktop-demo" : "release-desktop",
    cloudFiles: demo ? ["demo-save.json", "demo-save-recovery.json"] : ["save.json", "save-recovery.json"],
    characters: demo ? ["knight", "rogue", "ranger"] : null,
    modes: demo ? ["campaign"] : null,
    difficulties: demo ? ["difficulty-1"] : null,
    campaignActs: demo ? 1 : 3,
  };
}
export { resolveEdition, editionPolicy };
