import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../scripts/prepare-assets.mjs", () => ({ prepareAssets: vi.fn() }));

const { prepareAssets } = await import("../../scripts/prepare-assets.mjs");
const { checkPreparedAssets } = await import("../../scripts/check-prepared-assets.mjs");

describe("checkPreparedAssets", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "");
    vi.mocked(prepareAssets).mockReset();
  });

  it("refuses to run when asset preparation is skipped", async () => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "1");
    await expect(checkPreparedAssets()).rejects.toThrow("cannot run with ALCHEMY_SKIP_ASSETS=1");
    expect(prepareAssets).not.toHaveBeenCalled();
  });

  it("rethrows preparation failures after restoring outputs", async () => {
    const failure = new Error("prepare exploded");
    vi.mocked(prepareAssets).mockRejectedValueOnce(failure);
    await expect(checkPreparedAssets()).rejects.toBe(failure);
    expect(prepareAssets).toHaveBeenCalledTimes(1);
  }, 60_000);
});
