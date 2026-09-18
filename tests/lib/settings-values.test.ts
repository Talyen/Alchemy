import { describe, expect, it } from "vitest";
import { aspectRatioOptions, displayModeOptions } from "@/features/alchemy/shared/config/options";
import { settingsPersistenceCodec } from "@/features/alchemy/shared/stores/settings-store";
import { audioState } from "@/lib/audio/state";
import { DEFAULT_MASTER_VOLUME_PCT, DEFAULT_MUSIC_VOLUME_PCT, DEFAULT_SFX_VOLUME_PCT } from "@/lib/game-constants";
import {
  ASPECT_RATIO_VALUES,
  clampBrightnessPct,
  clampSpecialEffectsPct,
  clampVolumePct,
  DISPLAY_MODE_VALUES,
  normalizeDisplayPercent,
} from "@/lib/settings-values";

describe("settings values", () => {
  it("keeps every persisted choice available in the Options screen", () => {
    expect(aspectRatioOptions.map((option) => option.value)).toEqual(ASPECT_RATIO_VALUES);
    expect(displayModeOptions.map((option) => option.value)).toEqual(DISPLAY_MODE_VALUES);
  });

  it("uses the persisted audio defaults before React effects mount", () => {
    const defaults = settingsPersistenceCodec.createDefault();
    expect(defaults.musicVolume).toBe(DEFAULT_MUSIC_VOLUME_PCT);
    expect(defaults.sfxVolume).toBe(DEFAULT_SFX_VOLUME_PCT);
    expect(defaults.masterVolume).toBe(DEFAULT_MASTER_VOLUME_PCT);
    expect(audioState.musicVolume).toBe(DEFAULT_MUSIC_VOLUME_PCT / 100);
    expect(audioState.sfxVolume).toBe(DEFAULT_SFX_VOLUME_PCT / 100);
    expect(audioState.masterVolume).toBe(DEFAULT_MASTER_VOLUME_PCT / 100);
  });

  it("clamps numeric settings to their ranges", () => {
    expect(clampVolumePct(-20)).toBe(0);
    expect(clampVolumePct(1000)).toBe(100);
    expect(clampBrightnessPct(0)).toBe(50);
    expect(clampBrightnessPct(1000)).toBe(150);
    expect(clampSpecialEffectsPct(-1)).toBe(0);
    expect(clampSpecialEffectsPct(101)).toBe(100);
  });

  it("normalizes display sizes to range, step, and finite numbers", () => {
    expect(normalizeDisplayPercent("gameSizePercent", 82)).toBe(80);
    expect(normalizeDisplayPercent("gameSizePercent", 83)).toBe(85);
    expect(normalizeDisplayPercent("gameSizePercent", 10)).toBe(80);
    expect(normalizeDisplayPercent("tooltipSizePercent", 200)).toBe(125);
    expect(normalizeDisplayPercent("gameSizePercent", Number.NaN)).toBe(100);
    expect(normalizeDisplayPercent("gameSizePercent", Number.POSITIVE_INFINITY)).toBe(100);
    expect(normalizeDisplayPercent("gameSizePercent", "large")).toBe(100);
  });
});
