export const BUTTON_SHAPE = "rounded-xl";

export const BUTTON_WIDTH_MENU = "w-[calc(19.2*var(--content-rem,1rem))]";
export const BUTTON_WIDTH_DIALOG = "w-56";
export const BUTTON_WIDTH_ACTION = "min-w-56";

export type ButtonWidthTier = "menu" | "dialog" | "action" | "full";

export const BUTTON_WIDTH_TIER_CLASS: Record<ButtonWidthTier, string> = {
  menu: BUTTON_WIDTH_MENU,
  dialog: BUTTON_WIDTH_DIALOG,
  action: BUTTON_WIDTH_ACTION,
  full: "w-full",
};
