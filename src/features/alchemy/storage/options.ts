// Option save migration helpers for display and UI preference fields.
// Depends on save defaults and persisted option type contracts.
import type { DisplayMode, UiScale } from "../types";
import { defaultSaveData } from "./types";

// Display mode is platform-facing, so unknown persisted values fall back to the default mode.
export function normalizeDisplayMode(displayMode: unknown): DisplayMode {
  if (displayMode === "windowed" || displayMode === "borderless-fullscreen" || displayMode === "fullscreen") {
    return displayMode;
  }

  return defaultSaveData.displayMode;
}

// UI scale is persisted as a string percentage and must stay within supported option values.
export function normalizeUiScale(uiScale: unknown): UiScale {
  if (uiScale === "90" || uiScale === "100" || uiScale === "110" || uiScale === "120") {
    return uiScale;
  }

  return defaultSaveData.uiScale;
}
