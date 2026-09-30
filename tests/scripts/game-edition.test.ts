import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { releaseEdition, assertPackageEdition } from "../../scripts/lib/release/game-edition.mjs";
import { validateDesktopBuildConfig } from "../../scripts/lib/release/desktop-build-config.mjs";
const { editionPolicy, resolveEdition } = createRequire(import.meta.url)("../../game-edition.mjs");
describe("edition packaging and upload identity", () => {
  const env = {
    ALCHEMY_EDITION: "demo",
    STEAM_DEMO_APP_ID: "1234",
    STEAM_APP_ID: "5678",
    STEAM_DEMO_DEPOT_ID: "1235",
    CI_RELEASE: "true",
  };
  it("defaults to full and keeps output and cloud namespaces separate", () => {
    expect(resolveEdition()).toBe("full");
    expect(() => resolveEdition("preview")).toThrow();
    expect(editionPolicy("demo").cloudFiles).not.toEqual(editionPolicy("full").cloudFiles);
    expect(releaseEdition(env).packageDirectory).toBe("release-desktop-demo");
    expect(releaseEdition(env).steamDepotId).toBe("1235");
  });
  it("checks production IDs before builds and rejects a shared App ID", () => {
    expect(validateDesktopBuildConfig(env).steamAppId).toBe("1234");
    expect(() => validateDesktopBuildConfig({ ...env, STEAM_DEMO_APP_ID: "5678" })).toThrow("distinct");
    expect(() => validateDesktopBuildConfig({ ...env, STEAM_DEMO_APP_ID: undefined })).toThrow();
  });
  it("rejects edition, upload and wishlist target mismatches", () => {
    const metadata = { gameEdition: "demo", steamAppId: "1234", steamDepotId: "1235", fullGameSteamAppId: "5678" };
    expect(() => assertPackageEdition(metadata, { edition: "demo" }, env)).not.toThrow();
    expect(() => assertPackageEdition(metadata, { edition: "full" }, env)).toThrow("edition");
    expect(() => assertPackageEdition({ ...metadata, steamDepotId: "7777" }, { edition: "demo" }, env)).toThrow(
      "depot",
    );
    expect(() => assertPackageEdition({ ...metadata, steamAppId: "5678" }, { edition: "demo" }, env)).toThrow("target");
    expect(() => assertPackageEdition({ ...metadata, fullGameSteamAppId: "1234" }, { edition: "demo" }, env)).toThrow(
      "wishlist",
    );
  });
});
