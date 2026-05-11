// Display and audio-facing option lists for the options screen.
// Depends only on alchemy option types.
import type { DisplayMode, ResolutionOption, UiScale } from "../types";

// Resolution choices are virtual canvas targets, not direct browser CSS sizes.
export const resolutionOptions: ResolutionOption[] = ["1366x768", "1600x900", "1920x1080", "1920x1200", "2560x1080", "2560x1440", "3440x1440", "3840x2160"];

// Display modes are passed through the platform adapter so browser and desktop
// builds can share one options screen.
export const displayModeOptions: Array<{ value: DisplayMode; label: string }> = [
  { value: "windowed", label: "Windowed" },
  { value: "borderless-fullscreen", label: "Borderless Fullscreen" },
  { value: "fullscreen", label: "Fullscreen" },
];

// UI scale is stored as a percentage string to match persisted save data.
export const uiScaleOptions: Array<{ value: UiScale; label: string }> = [
  { value: "90", label: "Small" },
  { value: "100", label: "Normal" },
  { value: "110", label: "Large" },
  { value: "120", label: "Very Large" },
];
