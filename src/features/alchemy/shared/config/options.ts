// Display and audio-facing option lists for the options screen.
// Depends only on alchemy option types.
import type { AspectRatioOption, DisplayMode, UiScale } from "../types";

// Aspect ratio choices determine virtual canvas width (height is fixed at 1080).
// Auto selects the closest supported canvas shape for the current CSS viewport.
export const aspectRatioOptions: Array<{ value: AspectRatioOption; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "16:9", label: "Standard (16:9)" },
  { value: "16:10", label: "Narrow (16:10)" },
  { value: "21:9", label: "Ultrawide (21:9)" },
];

// Display modes are passed through the platform adapter so browser and desktop
// builds can share one options screen.
export const displayModeOptions: Array<{ value: DisplayMode; label: string }> = [
  { value: "windowed", label: "Windowed" },
  { value: "borderless-fullscreen", label: "Borderless Fullscreen" },
  { value: "fullscreen", label: "Fullscreen" },
];

// UI scale adjusts rem-based text and fixed-size controls; the virtual stage
// continues to fit the viewport independently.
export const uiScaleOptions: Array<{ value: UiScale; label: string }> = [
  { value: "90", label: "Small" },
  { value: "100", label: "Normal" },
  { value: "110", label: "Large" },
  { value: "120", label: "Very Large" },
];
