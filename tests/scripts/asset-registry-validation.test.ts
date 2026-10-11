import { describe, expect, it, vi } from "vitest";

import { validateMusicRegistry } from "../../scripts/assets/music-assets.mjs";
import {
  curatedSoundFiles,
  generatedSoundAssets,
  validateSoundAssetRegistry,
} from "../../scripts/assets/sound-assets.mjs";
import { resolveAssetConcurrency, soundTransformSettings } from "../../scripts/assets/asset-constants.mjs";

describe("registry validation consolidation", () => {
  it("rejects case-insensitive duplicate music names", async () => {
    await expect(validateMusicRegistry(["Theme.ogg", "theme.OGG"])).rejects.toThrow(
      'Duplicate asset target "theme.OGG"',
    );
    await expect(validateMusicRegistry(["a.ogg", "b.mp3"])).resolves.toEqual(["a.ogg", "b.mp3"]);
  });

  it.each([false, true])("rejects generated targets that are also curated sounds (case alias: %s)", async (alias) => {
    await expect(validateSoundAssetRegistry()).resolves.toBeUndefined();
    const overlap = generatedSoundAssets[0].target;
    curatedSoundFiles.push(alias ? overlap[0].toUpperCase() + overlap.slice(1) : overlap);
    try {
      await expect(validateSoundAssetRegistry()).rejects.toThrow(
        `Sound target is both generated and curated: "${overlap}"`,
      );
    } finally {
      curatedSoundFiles.pop();
    }
  });

  it.each(["../escaped.ogg", "nested/escaped.ogg", "nested\\escaped.ogg"])(
    "rejects sound targets outside the managed output directory: %s",
    async (target) => {
      generatedSoundAssets.push({ source: "unique.wav", target });
      try {
        await expect(validateSoundAssetRegistry()).rejects.toThrow("Invalid target");
      } finally {
        generatedSoundAssets.pop();
      }
      curatedSoundFiles.push(target);
      try {
        await expect(validateSoundAssetRegistry()).rejects.toThrow("Invalid target");
      } finally {
        curatedSoundFiles.pop();
      }
    },
  );

  it("rejects sound output collisions on case-insensitive filesystems", async () => {
    const target = generatedSoundAssets[0].target;
    generatedSoundAssets.push({ source: "unique.wav", target: target[0].toUpperCase() + target.slice(1) });
    try {
      await expect(validateSoundAssetRegistry()).rejects.toThrow("Duplicate asset target");
    } finally {
      generatedSoundAssets.pop();
    }
    curatedSoundFiles.push("extra.ogg", "Extra.ogg");
    try {
      await expect(validateSoundAssetRegistry()).rejects.toThrow("Duplicate asset target");
    } finally {
      curatedSoundFiles.splice(-2);
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
