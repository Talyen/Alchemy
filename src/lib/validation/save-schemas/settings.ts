import { z } from "zod";
import {
  DEFAULT_BACKGROUND_GLOW_PCT,
  DEFAULT_BACKGROUND_PARTICLES_PCT,
  DEFAULT_BRIGHTNESS_PCT,
  DEFAULT_MASTER_VOLUME_PCT,
  DEFAULT_MUSIC_VOLUME_PCT,
  DEFAULT_SFX_VOLUME_PCT,
} from "@/lib/game-constants";
import { clamp } from "@/lib/math";
import { DISPLAY_MODE_VALUES, SETTINGS_RANGES } from "@/lib/settings-values";

function clampedSetting(defaultValue: number, range: { min: number; max: number }) {
  return z
    .number()
    .catch(defaultValue)
    .transform((value) => clamp(value, range.min, range.max));
}

/** Persisted preferences and fresh-session defaults share one field definition. */
export const SettingsSaveFieldsSchema = z.object({
  displayMode: z.enum(DISPLAY_MODE_VALUES).catch("borderless-fullscreen"),
  brightness: clampedSetting(DEFAULT_BRIGHTNESS_PCT, SETTINGS_RANGES.brightness),
  backgroundParticlesIntensity: clampedSetting(DEFAULT_BACKGROUND_PARTICLES_PCT, SETTINGS_RANGES.specialEffects),
  backgroundGlowIntensity: clampedSetting(DEFAULT_BACKGROUND_GLOW_PCT, SETTINGS_RANGES.specialEffects),
  musicVolume: clampedSetting(DEFAULT_MUSIC_VOLUME_PCT, SETTINGS_RANGES.volume),
  sfxVolume: clampedSetting(DEFAULT_SFX_VOLUME_PCT, SETTINGS_RANGES.volume),
  masterVolume: clampedSetting(DEFAULT_MASTER_VOLUME_PCT, SETTINGS_RANGES.volume),
  muteInBackground: z.boolean().catch(true),
  bossLyricsEnabled: z.boolean().catch(true),
  autoEndTurn: z.boolean().catch(true),
  rememberAutoplayPreference: z.boolean().catch(false),
  autoplayEnabled: z.boolean().catch(false),
});

export type SettingsSaveFields = z.output<typeof SettingsSaveFieldsSchema>;

export function createDefaultSettingsSaveFields(): SettingsSaveFields {
  return SettingsSaveFieldsSchema.parse({});
}
