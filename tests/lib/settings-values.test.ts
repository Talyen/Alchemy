import { describe, expect, it } from "vitest";
import { aspectRatioOptions, displayModeOptions } from "@/features/alchemy/shared/config/options";
import { settingsPersistenceCodec } from "@/features/alchemy/shared/stores/settings-store";
import { audioState } from "@/lib/audio-state";
import { DEFAULT_MASTER_VOLUME_PCT, DEFAULT_MUSIC_VOLUME_PCT, DEFAULT_SFX_VOLUME_PCT } from "@/lib/game-constants";
import { ASPECT_RATIO_VALUES, DISPLAY_MODE_VALUES } from "@/lib/settings-values";

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
});
