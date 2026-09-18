import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateMusicRegistry } from "../../scripts/assets/music-assets.mjs";
import { validateSoundAssetRegistry } from "../../scripts/assets/sound-assets.mjs";
import { resolveAssetConcurrency, soundTransformSettings } from "../../scripts/lib/asset-constants.mjs";
import { optimizationFailures } from "../../scripts/optimize-pipelines.mjs";
import { failedMessagesResult, failedResult, targetErrorHandler } from "../../scripts/lib/process-helpers.mjs";

describe("registry validation consolidation", () => {
  it("rejects case-insensitive duplicate music names", async () => {
    await expect(validateMusicRegistry(["Theme.ogg", "theme.OGG"])).rejects.toThrow(
      'Duplicate asset target "theme.OGG"',
    );
    await expect(validateMusicRegistry(["a.ogg", "b.mp3"])).resolves.toEqual(["a.ogg", "b.mp3"]);
  });

  it("rejects generated targets that are also curated sounds", async () => {
    await expect(validateSoundAssetRegistry()).resolves.toBeUndefined();
    const { generatedSoundAssets, curatedSoundFiles } = await import("../../scripts/assets/sound-assets.mjs");
    const overlap = generatedSoundAssets[0].target;
    curatedSoundFiles.push(overlap);
    try {
      await expect(validateSoundAssetRegistry()).rejects.toThrow(
        `Sound target is both generated and curated: "${overlap}"`,
      );
    } finally {
      curatedSoundFiles.pop();
    }
  });
});

describe("sound transform settings", () => {
  it("copies OGG sources and converts everything else with loudness normalization", () => {
    expect(soundTransformSettings(".ogg")).toEqual({ mode: "copy" });
    expect(soundTransformSettings(".wav")).toMatchObject({ mode: "convert", codec: "libvorbis", quality: "4" });
  });

  it("resolves worker concurrency from the environment with a positiveInteger floor", () => {
    vi.stubEnv("ALCHEMY_ASSET_CONCURRENCY", "");
    expect(resolveAssetConcurrency(4)).toBeLessThanOrEqual(4);
    vi.stubEnv("ALCHEMY_ASSET_CONCURRENCY", "1");
    expect(resolveAssetConcurrency(16)).toBe(1);
    vi.stubEnv("ALCHEMY_ASSET_CONCURRENCY", "0");
    expect(resolveAssetConcurrency(4)).toBeLessThanOrEqual(4);
    vi.unstubAllEnvs();
  });
});

describe("pipeline failure reporting", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("labels string, targeted, and unknown items without crashing", () => {
    expect(targetErrorHandler("a.ogg", new Error("bad"))).toEqual({
      message: "FAILED a.ogg: bad",
      entry: null,
    });
    expect(targetErrorHandler({ target: "b.ogg" }, "worse")).toEqual({
      message: "FAILED b.ogg: worse",
      entry: null,
    });
    expect(targetErrorHandler(null, 42)).toEqual({ message: "FAILED null: 42", entry: null });
  });

  it("joins only failed results behind the skip label", () => {
    const results = [
      { failed: false, message: "ok" },
      { failed: true, message: "FAILED x: bad" },
    ];
    expect(failedResult(results, "later steps")).toEqual({
      ok: false,
      error: "FAILED x: bad",
    });
    expect(failedMessagesResult(["a", "b"], "later steps")).toEqual({ ok: false, error: "a\nb" });
  });

  it("reports Error reasons by message instead of doubling the prefix", () => {
    const failures = optimizationFailures([
      { key: "sound", status: "rejected", reason: new Error("encoder broke") },
      { key: "music", status: "fulfilled", value: { ok: false, error: "missing track" } },
      { key: "art", status: "fulfilled", value: { ok: true } },
      { key: "video", status: "rejected", reason: null },
    ]);
    expect(failures.map((error) => error.message)).toEqual([
      "sound: encoder broke",
      "music: missing track",
      "video: null",
    ]);
    expect(failures[0].cause).toBeInstanceOf(Error);
  });
});
