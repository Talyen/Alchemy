// Shared card sizing and surface classes for battle, collection, and popup card UI.

// These clamp() CSS values size cards from the virtual stage rather than the
// browser viewport so preview emulation and desktop scaling stay consistent.
// Pixel bounds converted to cqh/cqw so the layout is resolution-independent
// (the stage container may be 1080, 2160, or any other height in the future).
export const battleCardWidthClass = "w-[clamp(20.56cqh,22cqh,31.11cqh)]";
export const handCardWidthClass = "w-[clamp(17.5cqh,18.7cqh,26.48cqh)]";
export const collectionCardWidthClass = "w-[clamp(14.44cqh,18.7cqh,19.44cqh)]";
export const viewCardWidthClass = "w-[clamp(17.5cqh,17.78cqh,26.48cqh)]";
export const collectionTileWidthClass = "w-[clamp(21cqh,21.34cqh,31.78cqh)]"; // 1.2× viewCardWidthClass for collection cards/bestiary tiles.
export const trinketCardWidthClass = "w-[clamp(24.5cqh,24.89cqh,37.07cqh)]"; // 1.4× viewCardWidthClass for larger trinket tiles.
export const pileCardWidthClass = "w-[clamp(12cqh,12.96cqh,18.25cqh)]";

// Mobile landscape uses the same virtual-stage battle composition as desktop.
export const mobileStageBattleCardWidthClass = "w-[clamp(30cqh,33cqh,36.67cqh)]";
export const mobileStageHandCardWidthClass = "w-[clamp(22.22cqh,24cqh,27.78cqh)]";

// Boss variants — 1.3× the standard battle card width for wider status panes.
export const bossCardWidthClass = "w-[calc(clamp(20.56cqh,22cqh,31.11cqh)*1.3)]";
export const bossMobileStageBattleCardWidthClass = "w-[calc(clamp(30cqh,33cqh,36.67cqh)*1.3)]";

// Card and popup surfaces stay centralized so repeated game widgets share the
// same tactile fantasy material treatment.
export const cardSurfaceClass = "relative overflow-hidden rounded-[30px] bg-black";
export const cardArtImageClass = "rounded-[30px] aspect-[3/4] object-cover";
export const squareArtImageClass = "rounded-[30px] aspect-square object-cover";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";
export const popupClassName =
  "absolute bottom-full left-1/2 z-40 mb-4 w-60 -translate-x-1/2 rounded-[20px] border border-border/80 bg-card px-3 py-3 text-left";

export const battleActorSectionClass = {
  desktop:
    "absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 gap-[clamp(17.5cqw,20cqw,21.88cqw)]",
  mobile:
    "absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 gap-[clamp(13.33cqw,16cqw,18.46cqw)]",
  ultrawide:
    "absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 gap-[clamp(13.125cqw,20cqw,23.44cqw)]",
} as const;

export const battleBottomBarClass = {
  desktop:
    "absolute inset-x-0 grid items-end gap-[clamp(1.25cqw,3cqw,2.19cqw)] px-2 bottom-2 grid-cols-[minmax(10.19cqh,0.24fr)_1fr_minmax(10.19cqh,0.24fr)] pb-1",
  mobile:
    "absolute inset-x-0 grid items-end gap-[clamp(0.83cqw,2cqw,1.46cqw)] px-2 bottom-[calc(7.78cqh+env(safe-area-inset-bottom))] grid-cols-[minmax(18.89cqh,0.18fr)_1fr_minmax(24.44cqh,0.18fr)] pb-0",
} as const;

export const battleBottomColumnClass = {
  desktop: "flex flex-col items-center justify-end gap-4 pb-4",
  mobile: "flex flex-col items-center justify-end gap-3 pb-8",
} as const;

export const battleHandContainerClass = {
  desktop: "flex min-w-0 items-end justify-center min-h-[30.9cqh] pb-3 pt-10",
  mobile: "flex min-w-0 items-end justify-center min-h-[35.6cqh] pb-0 pt-12",
} as const;
