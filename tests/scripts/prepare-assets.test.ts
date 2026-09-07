import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../scripts/optimize-assets.mjs", () => ({ optimizeAssets: vi.fn() }));
vi.mock("../../scripts/optimize-sounds.mjs", () => ({ optimizeSounds: vi.fn() }));
vi.mock("../../scripts/optimize-music.mjs", () => ({ optimizeMusic: vi.fn() }));
vi.mock("../../scripts/sync-generated.mjs", () => ({ syncGenerated: vi.fn() }));

const { optimizeAssets } = await import("../../scripts/optimize-assets.mjs");
const { optimizeSounds } = await import("../../scripts/optimize-sounds.mjs");
const { optimizeMusic } = await import("../../scripts/optimize-music.mjs");
const { syncGenerated } = await import("../../scripts/sync-generated.mjs");
const { prepareAssets } = await import("../../scripts/prepare-assets.mjs");
const { runAllOptimizePipelines } = await import("../../scripts/optimize-pipelines.mjs");

describe("asset pipeline orchestration", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "");
    vi.mocked(optimizeAssets).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(optimizeSounds).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(optimizeMusic).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(syncGenerated).mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("reports audio and synchronization failures together without mutating thrown errors", async () => {
    const soundError = new Error("encoder broke");
    vi.mocked(optimizeSounds).mockRejectedValue(soundError);
    vi.mocked(optimizeMusic).mockResolvedValue({ ok: false, error: "missing track" });
    vi.mocked(syncGenerated).mockRejectedValue(new Error("barrel failed"));
    const failure = await prepareAssets().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as Error).message).toContain("sound: Error: encoder broke");
    expect((failure as Error).message).toContain("music: missing track");
    expect((failure as Error).message).toContain("synchronization failed: Error: barrel failed");
    expect(soundError.message).toBe("encoder broke");
    expect(syncGenerated).toHaveBeenCalledOnce();
  });

  it("syncs successful art even when sound fails", async () => {
    vi.mocked(optimizeSounds).mockResolvedValue({ ok: false, error: "sound failed" });
    await expect(prepareAssets()).rejects.toThrow("sound failed");
    expect(syncGenerated).toHaveBeenCalledOnce();
  });

  it("skips synchronization after art failure while retaining other failures", async () => {
    vi.mocked(optimizeAssets).mockRejectedValue("missing art");
    vi.mocked(optimizeMusic).mockRejectedValue("missing music");
    await expect(prepareAssets()).rejects.toThrow("art: missing art music: missing music");
    expect(syncGenerated).not.toHaveBeenCalled();
  });

  it("uses the same named failure reporting for optimization alone", async () => {
    vi.mocked(optimizeSounds).mockRejectedValue(null);
    vi.mocked(optimizeMusic).mockResolvedValue({ ok: false });
    await expect(runAllOptimizePipelines()).rejects.toThrow("sound: null music: failed");
    expect(syncGenerated).not.toHaveBeenCalled();
  });

  it("honors explicit preparation skip mode", async () => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "1");
    await prepareAssets();
    expect(optimizeAssets).not.toHaveBeenCalled();
    expect(optimizeSounds).not.toHaveBeenCalled();
    expect(optimizeMusic).not.toHaveBeenCalled();
    expect(syncGenerated).not.toHaveBeenCalled();
  });
});
