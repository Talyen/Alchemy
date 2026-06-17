// Canonical no-focus-ring classes for interactive game UI.
// Import this (or BUTTON_FOCUS from button-tokens) instead of inlining focus-visible ring utilities.
// Global suppression also lives under #vr-stage in src/index.css (@layer components).

export const NO_FOCUS_RING =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";
