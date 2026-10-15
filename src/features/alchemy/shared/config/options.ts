import type { DisplayMode } from "../types";

export const displayModeOptions = [
  { value: "windowed", label: "Windowed" },
  { value: "borderless-fullscreen", label: "Borderless Fullscreen" },
  { value: "fullscreen", label: "Fullscreen" },
] as const satisfies ReadonlyArray<{ value: DisplayMode; label: string }>;
