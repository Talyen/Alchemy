import { clamp } from "./math";

export const ASPECT_RATIO_VALUES = ["auto", "16:9", "16:10", "21:9"] as const;

export type AspectRatioOption = (typeof ASPECT_RATIO_VALUES)[number];

export const DISPLAY_MODE_VALUES = ["windowed", "borderless-fullscreen", "fullscreen"] as const;

export type DisplayMode = (typeof DISPLAY_MODE_VALUES)[number];

export const SETTINGS_RANGES = {
  brightness: { min: 50, max: 150 },
  volume: { min: 0, max: 100 },
  specialEffects: { min: 0, max: 100 },
} as const;

// Single owner for in-memory clamping: the settings store setters and hydrate
// both funnel through these, so a range change never needs a second edit.
// Load-time repair stays with SaveDataSchema (clampedSettingSchema), which is
// the boundary layer for untrusted payloads.
export function clampBrightnessPct(value: number): number {
  return clamp(value, SETTINGS_RANGES.brightness.min, SETTINGS_RANGES.brightness.max);
}

export function clampVolumePct(value: number): number {
  return clamp(value, SETTINGS_RANGES.volume.min, SETTINGS_RANGES.volume.max);
}

export function clampSpecialEffectsPct(value: number): number {
  return clamp(value, SETTINGS_RANGES.specialEffects.min, SETTINGS_RANGES.specialEffects.max);
}

export function resolveAutoplayEnabled(fields: {
  rememberAutoplayPreference: boolean;
  autoplayEnabled: boolean;
}): boolean {
  return fields.rememberAutoplayPreference && fields.autoplayEnabled;
}

export const DEVICE_DISPLAY_RANGES = {
  gameSizePercent: { min: 80, max: 120, step: 5 },
  tooltipSizePercent: { min: 90, max: 125, step: 5 },
} as const;

export interface DeviceDisplayPreferences {
  gameSizePercent: number;
  tooltipSizePercent: number;
}

export const DEFAULT_DEVICE_DISPLAY: DeviceDisplayPreferences = {
  gameSizePercent: 100,
  tooltipSizePercent: 100,
};

export function normalizeDisplayPercent(key: keyof DeviceDisplayPreferences, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_DEVICE_DISPLAY[key];
  const { min, max, step } = DEVICE_DISPLAY_RANGES[key];
  return clamp(Math.round(value / step) * step, min, max);
}
