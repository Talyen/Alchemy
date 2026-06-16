// Canonical interactive button tokens — shape, surface, sizing, motion, and intent.
import type { UISound } from "@/lib/sound-registry";
import { cn } from "@/lib/utils";
import {
  BUTTON_HOVER_DESTRUCTIVE,
  BUTTON_HOVER_PRIMARY,
  BUTTON_HOVER_SECONDARY,
  BUTTON_HOVER_TRANSITION,
} from "@/lib/ui/button-hover";

export const BUTTON_SHAPE = "rounded-xl";
export const BUTTON_SURFACE_NEUTRAL = "bg-background border border-border/80 text-foreground";
export const BUTTON_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const BUTTON_WIDTH_MENU = "w-56";
export const BUTTON_WIDTH_DIALOG = "w-40";
export const BUTTON_WIDTH_ACTION = "min-w-40";

export const BUTTON_HEIGHT_DEFAULT = "h-11";
export const BUTTON_HEIGHT_LG = "h-12";

export const BUTTON_PRESS = "active:brightness-95";
export const BUTTON_HOVER_SOUND: UISound = "buttonHover";

export { BUTTON_HOVER_DESTRUCTIVE, BUTTON_HOVER_PRIMARY, BUTTON_HOVER_SECONDARY, BUTTON_HOVER_TRANSITION };

export const CHIP_BUTTON_CLASS = cn(
  "inline-flex items-center gap-2 px-4 text-sm font-semibold text-foreground",
  BUTTON_SHAPE,
  BUTTON_HEIGHT_DEFAULT,
  BUTTON_SURFACE_NEUTRAL,
  BUTTON_HOVER_TRANSITION,
  BUTTON_HOVER_SECONDARY,
  BUTTON_FOCUS,
  BUTTON_PRESS,
  "active:bg-muted active:brightness-100",
);

export type ButtonWidthTier = "menu" | "dialog" | "action" | "full";

export const BUTTON_WIDTH_TIER_CLASS: Record<ButtonWidthTier, string> = {
  menu: BUTTON_WIDTH_MENU,
  dialog: BUTTON_WIDTH_DIALOG,
  action: BUTTON_WIDTH_ACTION,
  full: "w-full",
};
