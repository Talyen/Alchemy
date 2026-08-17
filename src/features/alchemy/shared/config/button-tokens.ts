// Canonical interactive button tokens — shape, surface, sizing, motion, and intent.
import {
  BUTTON_HOVER_DESTRUCTIVE,
  BUTTON_HOVER_PRIMARY,
  BUTTON_HOVER_SECONDARY,
  BUTTON_HOVER_TRANSITION,
  BUTTON_PRESS_OUTLINE,
} from "@/lib/ui/button-hover";

export const BUTTON_SHAPE = "rounded-xl";
export const BUTTON_SURFACE_NEUTRAL = "bg-background border border-border/80 text-foreground";

export const BUTTON_WIDTH_MENU = "w-[19.2rem]"; // menu-only; widened with larger menu button text
export const BUTTON_WIDTH_DIALOG = "w-56";
export const BUTTON_WIDTH_ACTION = "min-w-56";

export const BUTTON_HEIGHT_DEFAULT = "h-16";

export { BUTTON_PRESS_OUTLINE as BUTTON_PRESS };

export { BUTTON_HOVER_DESTRUCTIVE, BUTTON_HOVER_PRIMARY, BUTTON_HOVER_SECONDARY, BUTTON_HOVER_TRANSITION };

export type ButtonWidthTier = "menu" | "dialog" | "action" | "full";

export const BUTTON_WIDTH_TIER_CLASS: Record<ButtonWidthTier, string> = {
  menu: BUTTON_WIDTH_MENU,
  dialog: BUTTON_WIDTH_DIALOG,
  action: BUTTON_WIDTH_ACTION,
  full: "w-full",
};
