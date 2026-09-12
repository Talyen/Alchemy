import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../scripts/optimize-assets.mjs", () => ({ optimizeAssets: vi.fn() }));
vi.mock("../../scripts/optimize-sounds.mjs", () => ({ optimizeSounds: vi.fn() }));
vi.mock("../../scripts/optimize-music.mjs", () => ({ optimizeMusic: vi.fn() }));
vi.mock("../../scripts/sync-generated.mjs", () => ({ syncGenerated: vi.fn() }));

const { optimizeAssets } = await import("../../scripts/optimize-assets.mjs");
const { optimizeSounds } = await import("../../scripts/optimize-sounds.mjs");
const { optimizeMusic } = await import("../../scripts/optimize-music.mjs");
const { syncGenerated } = await import("../../scripts/sync-generated.mjs");
const { checkPreparedAssets } = await import("../../scripts/check-prepared-assets.mjs");

describe("checkPreparedAssets", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "");
    for (const optimize of [optimizeAssets, optimizeSounds, optimizeMusic]) {
      vi.mocked(optimize).mockReset().mockResolvedValue({ ok: true });
    }
    vi.mocked(syncGenerated).mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("refuses skip mode before checking any outputs", async () => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "1");
    await expect(checkPreparedAssets()).rejects.toThrow("cannot run with ALCHEMY_SKIP_ASSETS=1");
    expect(optimizeAssets).not.toHaveBeenCalled();
  });

  it("checks every pipeline and generated metadata in read-only mode", async () => {
    await expect(checkPreparedAssets()).resolves.toBeUndefined();
    for (const check of [optimizeAssets, optimizeSounds, optimizeMusic, syncGenerated]) {
      expect(check).toHaveBeenCalledWith({ check: true });
    }
  });

  it("reports pipeline failures and stale version metadata together", async () => {
    vi.mocked(optimizeAssets).mockResolvedValue({ ok: false, error: "stale art" });
    vi.mocked(optimizeMusic).mockRejectedValue(new Error("missing music"));
    vi.mocked(syncGenerated).mockRejectedValue(new Error("stale version"));
    await expect(checkPreparedAssets()).rejects.toThrow(/stale art[\s\S]*missing music[\s\S]*stale version/);
    expect(optimizeSounds).toHaveBeenCalledWith({ check: true });
  });
});
