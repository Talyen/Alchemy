// Option save migration helpers for display preference fields.
// Depends on save defaults and persisted option type contracts.
import type { DisplayMode } from "../types";
import { defaultSaveData } from "./defaults";

// Display mode is platform-facing, so unknown persisted values fall back to the default mode.
export function normalizeDisplayMode(displayMode: unknown): DisplayMode {
  if (displayMode === "windowed" || displayMode === "borderless-fullscreen" || displayMode === "fullscreen") {
    return displayMode;
  }

  return defaultSaveData.displayMode;
}
