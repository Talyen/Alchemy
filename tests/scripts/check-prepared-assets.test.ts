import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../scripts/optimize-assets.mjs", () => ({ optimizeAssets: vi.fn() }));
vi.mock("../../scripts/optimize-sounds.mjs", () => ({ optimizeSounds: vi.fn() }));
vi.mock("../../scripts/optimize-music.mjs", () => ({ optimizeMusic: vi.fn() }));
vi.mock("../../scripts/sync-art-barrels.mjs", () => ({ syncArtBarrels: vi.fn() }));
vi.mock("../../scripts/sync-version-metadata.mjs", () => ({ syncVersionMetadata: vi.fn() }));

const { optimizeAssets } = await import("../../scripts/optimize-assets.mjs");
const { optimizeSounds } = await import("../../scripts/optimize-sounds.mjs");
const { optimizeMusic } = await import("../../scripts/optimize-music.mjs");
const { syncArtBarrels } = await import("../../scripts/sync-art-barrels.mjs");
const { syncVersionMetadata } = await import("../../scripts/sync-version-metadata.mjs");
const { checkPreparedAssets } = await import("../../scripts/check-prepared-assets.mjs");

describe("checkPreparedAssets", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "");
    for (const optimize of [optimizeAssets, optimizeSounds, optimizeMusic]) {
      vi.mocked(optimize).mockReset().mockResolvedValue({ ok: true });
    }
    vi.mocked(syncArtBarrels).mockReset().mockResolvedValue(undefined);
    vi.mocked(syncVersionMetadata).mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("refuses skip mode before checking any outputs", async () => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "1");
    await expect(checkPreparedAssets()).rejects.toThrow("cannot run with ALCHEMY_SKIP_ASSETS=1");
    expect(optimizeAssets).not.toHaveBeenCalled();
  });

  it("checks every pipeline, art barrel, and version metadata in read-only mode", async () => {
    await expect(checkPreparedAssets()).resolves.toBeUndefined();
    for (const check of [optimizeAssets, optimizeSounds, optimizeMusic, syncArtBarrels, syncVersionMetadata]) {
      expect(check).toHaveBeenCalledWith({ check: true });
    }
  });

  it("reports pipeline failures and stale generated outputs together", async () => {
    vi.mocked(optimizeAssets).mockResolvedValue({ ok: false, error: "stale art" });
    vi.mocked(optimizeMusic).mockRejectedValue(new Error("missing music"));
    vi.mocked(syncVersionMetadata).mockRejectedValue(new Error("stale version"));
    await expect(checkPreparedAssets()).rejects.toThrow(/stale art[\s\S]*missing music[\s\S]*stale version/);
    expect(optimizeSounds).toHaveBeenCalledWith({ check: true });
    expect(syncArtBarrels).toHaveBeenCalledWith({ check: true });
  });
});
