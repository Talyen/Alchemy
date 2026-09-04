export const ASPECT_RATIO_VALUES = ["auto", "16:9", "16:10", "21:9"] as const;

export type AspectRatioOption = (typeof ASPECT_RATIO_VALUES)[number];

export const DISPLAY_MODE_VALUES = ["windowed", "borderless-fullscreen", "fullscreen"] as const;

export type DisplayMode = (typeof DISPLAY_MODE_VALUES)[number];

export const SETTINGS_RANGES = {
  brightness: { min: 50, max: 150 },
  volume: { min: 0, max: 100 },
  specialEffects: { min: 0, max: 100 },
} as const;

export function resolveAutoplayEnabled(fields: {
  rememberAutoplayPreference: boolean;
  autoplayEnabled: boolean;
}): boolean {
  return fields.rememberAutoplayPreference && fields.autoplayEnabled;
}
