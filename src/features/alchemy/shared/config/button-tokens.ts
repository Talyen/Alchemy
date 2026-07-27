// Canonical interactive button tokens — shape, surface, sizing, motion, and intent.
import type { UISound } from "@/lib/sound-registry";
import {
  BUTTON_HOVER_DESTRUCTIVE,
  BUTTON_HOVER_PRIMARY,
  BUTTON_HOVER_SECONDARY,
  BUTTON_HOVER_TRANSITION,
  BUTTON_PRESS_OUTLINE,
} from "@/lib/ui/button-hover";
import { cn } from "@/lib/utils";

export const BUTTON_SHAPE = "rounded-xl";
export const BUTTON_SURFACE_NEUTRAL = "bg-background border border-border/80 text-foreground";

export const BUTTON_WIDTH_MENU = "w-56";
export const BUTTON_WIDTH_DIALOG = "w-40";
export const BUTTON_WIDTH_ACTION = "min-w-40";

export const BUTTON_HEIGHT_DEFAULT = "h-11";

export { BUTTON_PRESS_OUTLINE as BUTTON_PRESS };
export const BUTTON_HOVER_SOUND: UISound = "buttonHover";

export { BUTTON_HOVER_DESTRUCTIVE, BUTTON_HOVER_PRIMARY, BUTTON_HOVER_SECONDARY, BUTTON_HOVER_TRANSITION };

export const CHIP_BUTTON_CLASS = cn(
  "inline-flex items-center gap-2 px-4 text-sm font-semibold text-foreground",
  BUTTON_SHAPE,
  BUTTON_HEIGHT_DEFAULT,
  BUTTON_SURFACE_NEUTRAL,
  BUTTON_HOVER_TRANSITION,
  BUTTON_HOVER_SECONDARY,
  BUTTON_PRESS_OUTLINE,
  "active:bg-muted active:brightness-100",
);

export type ButtonWidthTier = "menu" | "dialog" | "action" | "full";

export const BUTTON_WIDTH_TIER_CLASS: Record<ButtonWidthTier, string> = {
  menu: BUTTON_WIDTH_MENU,
  dialog: BUTTON_WIDTH_DIALOG,
  action: BUTTON_WIDTH_ACTION,
  full: "w-full",
};
