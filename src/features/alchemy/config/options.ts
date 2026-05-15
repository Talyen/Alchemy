// Display and audio-facing option lists for the options screen.
// Depends only on alchemy option types.
import type { DisplayMode, ResolutionOption, UiScale } from "../types";

// Aspect ratio choices determine virtual canvas width (height is fixed at 1080).
// Only distinct aspect ratios are offered: 16:9 (standard), 16:10 (narrow), ~21:9 (ultrawide).
export const resolutionOptions: Array<{ value: ResolutionOption; label: string }> = [
  { value: "1920x1080", label: "Standard (16:9)" },
  { value: "1920x1200", label: "Narrow (16:10)" },
  { value: "2560x1080", label: "Ultrawide (21:9)" },
];

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
