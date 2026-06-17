// Shared CSS-only button hover feedback (no transform — avoids text jitter).
// Avoid CSS filter/brightness on hover — it re-rasterizes the VR-scaled stage and blurs nearby art.
// Imported by the Button primitive and alchemy choice/tab controls.

export const BUTTON_HOVER_TRANSITION = "transition-[background-color,box-shadow] duration-150";

/** Filled primary CTAs — animated bloom puff on hover (see .button-primary-bloom in index.css) */
export const BUTTON_HOVER_PRIMARY = "button-primary-bloom";

export const BUTTON_HOVER_DESTRUCTIVE = "hover:bg-destructive/90";

/** Outline and menu secondary buttons — also used for choice chips and tabs */
export const BUTTON_HOVER_SECONDARY = "hover:bg-muted/80";

export const BUTTON_PRESS_OUTLINE = "active:bg-muted/90";
