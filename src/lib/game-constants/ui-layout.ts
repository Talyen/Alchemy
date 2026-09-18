export const STAGE_HEIGHT = 1080;
export const BATTLE_ACTOR_TOP = "34%";

export const COLLECTION_PAGE_SIZE = 8;
export const BESTIARY_PAGE_SIZE = 6;
export const TRINKET_PAGE_SIZE = 8;

export const BUTTON_HOVER_TRANSITION = "transition-[color,background-color,border-color,box-shadow] duration-150";
// Shared hover layers for the Button primitive. Variant-specific tweaks
// (outline border/text illumination) stay inline in button.tsx variants;
// these consts own only the shared transition and bloom/background layers.
export const BUTTON_HOVER_PRIMARY = "button-primary-bloom";
export const BUTTON_HOVER_DESTRUCTIVE = "hover:bg-destructive/90";
export const BUTTON_HOVER_SECONDARY = "hover:bg-muted/80";
