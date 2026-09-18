import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../scripts/prepare-assets.mjs", () => ({ prepareAssets: vi.fn() }));
vi.mock("../../scripts/check-prepared-assets.mjs", () => ({ checkPreparedAssets: vi.fn() }));
vi.mock("../../scripts/optimize-pipelines.mjs", () => ({ runAllOptimizePipelines: vi.fn() }));
vi.mock("../../scripts/sync-generated.mjs", () => ({ syncGenerated: vi.fn() }));

const { prepareAssets } = await import("../../scripts/prepare-assets.mjs");
const { checkPreparedAssets } = await import("../../scripts/check-prepared-assets.mjs");
const { runAllOptimizePipelines } = await import("../../scripts/optimize-pipelines.mjs");
const { syncGenerated } = await import("../../scripts/sync-generated.mjs");
const { runAssetCommand } = await import("../../scripts/assets.mjs");

describe("runAssetCommand dispatch", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "");
    vi.mocked(prepareAssets).mockReset().mockResolvedValue(undefined);
    vi.mocked(checkPreparedAssets).mockReset().mockResolvedValue(undefined);
    vi.mocked(runAllOptimizePipelines).mockReset().mockResolvedValue([]);
    vi.mocked(syncGenerated).mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("runs full preparation by default", async () => {
    await runAssetCommand({ help: false, check: false, mode: "--prepare" });
    expect(prepareAssets).toHaveBeenCalledOnce();
  });

  it("routes sync and optimize modes, threading check mode through", async () => {
    await runAssetCommand({ help: false, check: true, mode: "--sync" });
    expect(syncGenerated).toHaveBeenCalledWith({ check: true });
    await runAssetCommand({ help: false, check: true, mode: "--optimize" });
    expect(runAllOptimizePipelines).toHaveBeenCalledWith({ check: true });
    await runAssetCommand({ help: false, check: false, mode: "--optimize" });
    expect(runAllOptimizePipelines).toHaveBeenCalledWith(undefined);
  });

  it("runs the full read-only check for a bare --check", async () => {
    await runAssetCommand({ help: false, check: true, mode: "--prepare" });
    expect(checkPreparedAssets).toHaveBeenCalledOnce();
    expect(prepareAssets).not.toHaveBeenCalled();
  });

  it("skips mutating commands under ALCHEMY_SKIP_ASSETS but still checks", async () => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "1");
    await runAssetCommand({ help: false, check: false, mode: "--prepare" });
    expect(prepareAssets).not.toHaveBeenCalled();
    await runAssetCommand({ help: false, check: true, mode: "--prepare" });
    expect(checkPreparedAssets).toHaveBeenCalledOnce();
  });
});
