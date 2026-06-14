// Shared card sizing and surface classes for battle, collection, and popup card UI.

// These clamp() CSS values size cards from the virtual stage rather than the
// browser viewport so preview emulation and desktop scaling stay consistent.
// Pixel bounds converted to cqh/cqw so the layout is resolution-independent
// (the stage container may be 1080, 2160, or any other height in the future).
export const battleCardWidthClass = "w-[clamp(24.76cqh,25.16cqh,37.48cqh)]";
export const handCardWidthClass = "w-[clamp(22.28cqh,22.64cqh,33.73cqh)]";
export const viewCardWidthClass = "w-[clamp(17.5cqh,17.78cqh,26.48cqh)]";
export const collectionTileWidthClass = "w-[clamp(21cqh,21.34cqh,31.78cqh)]"; // 1.2× viewCardWidthClass for collection cards/bestiary tiles.
// One row of discovery-pack tiles (3:4 aspect, matches collectionTileWidthClass).
export const discoveryPackStageHeightClass = "h-[clamp(28cqh,28.45cqh,42.37cqh)]";
// Stage + hint + Continue + gaps between them.
export const discoveryPackBlockHeightClass = "h-[calc(clamp(28cqh,28.45cqh,42.37cqh)+5.5rem)]";
export const collectionGridGapXClass = "gap-x-3";
export const collectionShellWidthClass = "w-full max-w-6xl";
// Shared with CollectionGrid — same column count, gap, and justify-items-center.
export const collectionCardGridClass = `grid w-full justify-items-center ${collectionGridGapXClass} grid-cols-4`;
export const collectionBoonGridClass = `grid w-full justify-items-center ${collectionGridGapXClass} grid-cols-3`;
// Header + pack block + gap — fixed stack height so justify-center does not shift between phases.
export const discoveryScreenStackHeightClass = "h-[calc(clamp(28cqh,28.45cqh,42.37cqh)+12.5rem)]";
export const boonCardWidthClass = "w-[clamp(24.5cqh,24.89cqh,37.07cqh)]"; // 1.4× viewCardWidthClass for larger boon tiles.
export const pileCardWidthClass = "w-[clamp(12cqh,12.96cqh,18.25cqh)]";

// Boss variants — 1.3× the standard battle card width for wider status panes.
export const bossCardWidthClass = "w-[calc(clamp(24.76cqh,25.16cqh,37.48cqh)*1.3)]";

// Card and popup surfaces stay centralized so repeated game widgets share the
// same tactile fantasy material treatment.
export const cardSurfaceClass = "relative overflow-hidden rounded-[30px] bg-black";
export const cardArtImageClass = "rounded-[30px] aspect-[3/4] object-cover";
export const squareArtImageClass = "rounded-[30px] aspect-square object-cover";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";
export const popupBaseClassName =
  "absolute left-1/2 z-50 rounded-[20px] border border-border bg-card px-3 py-3 text-left";

export const tooltipAnchorClassNames = {
  above: "bottom-full mb-4",
  below: "top-full mt-4 bottom-auto",
} as const;

/** @deprecated Use popupBaseClassName + tooltipAnchorClassNames via TooltipPanel */
export const popupClassName = `${popupBaseClassName} ${tooltipAnchorClassNames.above}`;

export const battleActorSectionClass = {
  desktop:
    "absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 gap-[clamp(17.5cqw,20cqw,21.88cqw)]",
  ultrawide:
    "absolute inset-x-0 flex -translate-y-1/2 items-start justify-center px-4 gap-[clamp(13.125cqw,20cqw,23.44cqw)]",
} as const;

export const battleBottomBarClass =
  "absolute inset-x-0 grid items-end gap-[clamp(1.25cqw,3cqw,2.19cqw)] px-2 bottom-2 grid-cols-[minmax(10.19cqh,0.24fr)_1fr_minmax(10.19cqh,0.24fr)] pb-1";

export const battleBottomColumnClass = "flex flex-col items-center justify-end gap-4 pb-4";

export const battleHandContainerClass = "flex min-w-0 items-end justify-center min-h-[30.9cqh] pb-3 pt-10";
