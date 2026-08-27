import { describe, expect, it } from "vitest";
import {
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_SFX_VOLUME,
  FADE_IN_DELAY,
  FADE_IN_DURATION,
  FADE_OUT_DURATION,
  MUSIC_KEYS,
  MUSIC_MASTER_GAIN,
  SFX_COOLDOWN_MS,
  SFX_DEFEAT_VOLUME,
  SFX_SLICE_DEATH_VOLUME,
  SFX_UI_VOLUME,
  SFX_VICTORY_VOLUME,
} from "@/lib/game-constants/audio";

describe("audio constants", () => {
  it("keeps volume and fade domains valid", () => {
    for (const value of [
      DEFAULT_MUSIC_VOLUME,
      DEFAULT_SFX_VOLUME,
      MUSIC_MASTER_GAIN,
      SFX_UI_VOLUME,
      SFX_VICTORY_VOLUME,
      SFX_DEFEAT_VOLUME,
      SFX_SLICE_DEATH_VOLUME,
    ]) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(FADE_OUT_DURATION).toBeGreaterThan(0);
    expect(FADE_IN_DELAY).toBeGreaterThan(0);
    expect(FADE_IN_DURATION).toBeGreaterThan(FADE_OUT_DURATION);
    expect(SFX_COOLDOWN_MS).toBeGreaterThan(0);
  });

  it("exposes distinct music keys", () => {
    const keys = Object.values(MUSIC_KEYS);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
