import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const { prepareAssets } = await import("../../scripts/prepare-assets.mjs");
const { runAllOptimizePipelines } = await import("../../scripts/optimize-pipelines.mjs");

describe("asset pipeline orchestration", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "");
    vi.mocked(optimizeAssets).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(optimizeSounds).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(optimizeMusic).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(syncArtBarrels).mockReset().mockResolvedValue(undefined);
    vi.mocked(syncVersionMetadata).mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("reports audio and synchronization failures together without mutating thrown errors", async () => {
    const soundError = new Error("encoder broke");
    vi.mocked(optimizeSounds).mockRejectedValue(soundError);
    vi.mocked(optimizeMusic).mockResolvedValue({ ok: false, error: "missing track" });
    vi.mocked(syncArtBarrels).mockRejectedValue(new Error("barrel failed"));
    vi.mocked(syncVersionMetadata).mockRejectedValue(new Error("version failed"));
    const failure = await prepareAssets().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as Error).message).toContain("sound: encoder broke");
    expect((failure as Error).message).toContain("music: missing track");
    expect((failure as Error).message).toContain("art synchronization failed: Error: barrel failed");
    expect((failure as Error).message).toContain("version synchronization failed: Error: version failed");
    expect(soundError.message).toBe("encoder broke");
    expect(syncArtBarrels).toHaveBeenCalledOnce();
    expect(syncVersionMetadata).toHaveBeenCalledOnce();
  });

  it("syncs successful art even when sound fails", async () => {
    vi.mocked(optimizeSounds).mockResolvedValue({ ok: false, error: "sound failed" });
    await expect(prepareAssets()).rejects.toThrow("sound failed");
    expect(syncArtBarrels).toHaveBeenCalledOnce();
  });

  it("skips art synchronization after art failure while still stamping the version", async () => {
    vi.mocked(optimizeAssets).mockRejectedValue("missing art");
    vi.mocked(optimizeMusic).mockRejectedValue("missing music");
    await expect(prepareAssets()).rejects.toThrow("art: missing art\nmusic: missing music");
    expect(syncArtBarrels).not.toHaveBeenCalled();
    expect(syncVersionMetadata).toHaveBeenCalledOnce();
  });

  it("uses the same named failure reporting for optimization alone", async () => {
    vi.mocked(optimizeSounds).mockRejectedValue(null);
    vi.mocked(optimizeMusic).mockResolvedValue({ ok: false });
    await expect(runAllOptimizePipelines()).rejects.toThrow("sound: null\nmusic: failed");
    expect(syncArtBarrels).not.toHaveBeenCalled();
    expect(syncVersionMetadata).not.toHaveBeenCalled();
  });

  it("honors explicit preparation skip mode", async () => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "1");
    await prepareAssets();
    expect(optimizeAssets).not.toHaveBeenCalled();
    expect(optimizeSounds).not.toHaveBeenCalled();
    expect(optimizeMusic).not.toHaveBeenCalled();
    expect(syncArtBarrels).not.toHaveBeenCalled();
    expect(syncVersionMetadata).not.toHaveBeenCalled();
  });
});
