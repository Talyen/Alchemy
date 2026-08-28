import type { AspectRatioOption, DisplayMode } from "../types";

export const aspectRatioOptions: Array<{ value: AspectRatioOption; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "16:9", label: "Standard (16:9)" },
  { value: "16:10", label: "Narrow (16:10)" },
  { value: "21:9", label: "Ultrawide (21:9)" },
];

export const displayModeOptions: Array<{ value: DisplayMode; label: string }> = [
  { value: "windowed", label: "Windowed" },
  { value: "borderless-fullscreen", label: "Borderless Fullscreen" },
  { value: "fullscreen", label: "Fullscreen" },
];
