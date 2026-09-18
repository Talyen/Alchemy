import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../scripts/sync-art-barrels.mjs", () => ({ syncArtBarrels: vi.fn(), syncGearArt: vi.fn() }));
vi.mock("../../scripts/sync-version-metadata.mjs", () => ({ syncVersionMetadata: vi.fn() }));

const { syncArtBarrels, syncGearArt } = await import("../../scripts/sync-art-barrels.mjs");
const { syncVersionMetadata } = await import("../../scripts/sync-version-metadata.mjs");
const { syncGenerated } = await import("../../scripts/sync-generated.mjs");

describe("syncGenerated fan-out", () => {
  beforeEach(() => {
    vi.mocked(syncArtBarrels).mockReset().mockResolvedValue(undefined);
    vi.mocked(syncGearArt).mockReset().mockResolvedValue(undefined);
    vi.mocked(syncVersionMetadata).mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("syncs art barrels and version metadata together by default", async () => {
    await syncGenerated();
    expect(syncArtBarrels).toHaveBeenCalledWith({ check: false });
    expect(syncVersionMetadata).toHaveBeenCalledWith({ check: false });
    expect(syncGearArt).not.toHaveBeenCalled();
  });

  it("passes check mode through to both outputs", async () => {
    await syncGenerated({ check: true });
    expect(syncArtBarrels).toHaveBeenCalledWith({ check: true });
    expect(syncVersionMetadata).toHaveBeenCalledWith({ check: true });
  });

  it("syncs only the selected slice for fine-grained commands", async () => {
    await syncGenerated({ artOnly: true });
    expect(syncArtBarrels).toHaveBeenCalledOnce();
    expect(syncVersionMetadata).not.toHaveBeenCalled();
    vi.clearAllMocks();
    await syncGenerated({ gearOnly: true });
    expect(syncGearArt).toHaveBeenCalledOnce();
    expect(syncArtBarrels).not.toHaveBeenCalled();
    vi.clearAllMocks();
    await syncGenerated({ versionOnly: true });
    expect(syncVersionMetadata).toHaveBeenCalledOnce();
    expect(syncArtBarrels).not.toHaveBeenCalled();
  });

  it("aggregates art and version failures instead of failing fast", async () => {
    vi.mocked(syncArtBarrels).mockRejectedValue(new Error("barrels broke"));
    vi.mocked(syncVersionMetadata).mockRejectedValue(new Error("version broke"));
    const failure = await syncGenerated().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as Error).message).toContain("barrels broke");
    expect((failure as Error).message).toContain("version broke");
  });
});
