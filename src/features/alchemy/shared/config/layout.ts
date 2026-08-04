// Shared card sizing and surface classes for battle, collection, and popup card UI.

// These clamp() CSS values size cards from the virtual stage rather than the
// browser viewport so preview emulation and desktop scaling stay consistent.
// Pixel bounds converted to cqh/cqw so the layout is resolution-independent
// (the stage container may be 1080, 2160, or another height in the future).
export const battleCardWidthClass = "w-[clamp(28.5cqh,28.9cqh,43.1cqh)]";
export const handCardWidthClass = "w-[clamp(22.28cqh,22.64cqh,33.73cqh)]";
// Non-battle card/tile widths are authored ~1.2× denser than the prior stage sizes.
export const viewCardWidthClass = "w-[clamp(21cqh,21.34cqh,31.78cqh)]"; // was 17.5 / 17.78 / 26.48
export const collectionTileWidthClass = "w-[clamp(25.2cqh,25.61cqh,38.14cqh)]"; // was 21 / 21.34 / 31.78
// Grid cells use max-width so densified tiles shrink instead of overlapping neighbors when
// the shell is narrower than 4×tile + gaps (e.g. rem-fixed max-w after UI Scale removal).
export const collectionGridTileWidthClass = "mx-auto w-full max-w-[clamp(25.2cqh,25.61cqh,38.14cqh)]";
export const collectionGridGapXClass = "gap-x-5";
// Must fit 4× collection tile max + 3× gap-x-5 + ScreenShell p-[2.1rem] at 1080cqh (~1.2kpx).
export const collectionShellWidthClass = "max-w-7xl";
// Shared with CollectionGrid — stretch columns; tiles self-center via collectionGrid*WidthClass.
export const collectionCardGridClass = `grid w-full ${collectionGridGapXClass} grid-cols-4`;
export const collectionTrinketGridClass = `grid w-full ${collectionGridGapXClass} grid-cols-3`;
export const collectionGridTrinketWidthClass = "mx-auto w-full max-w-[clamp(29.4cqh,29.87cqh,44.48cqh)]";
export const pileCardWidthClass = "w-[clamp(13.8cqh,14.9cqh,21cqh)]";

// Boss variants — 1.3× the standard battle card width for wider status panes.
export const bossCardWidthClass = "w-[calc(clamp(28.5cqh,28.9cqh,43.1cqh)*1.3)]";

// Non-battle portrait/card panels (e.g. difficulty select) — 1.2× battleCardWidthClass, battle token untouched.
export const nonBattleCardWidthClass = "w-[clamp(29.71cqh,30.19cqh,44.98cqh)]";

// Card and popup surfaces stay centralized so repeated game widgets share the
// same tactile fantasy material treatment.
export const cardSurfaceClass = "relative overflow-hidden rounded-shell-hero bg-black";
export const cardArtImageClass = "rounded-shell-hero aspect-[3/4] object-cover";
export const squareArtImageClass = "rounded-shell-hero aspect-square object-cover";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";
export const popupBaseClassName =
  "absolute left-1/2 z-50 rounded-shell-tooltip border border-border bg-card px-3 py-3 text-left";

// Selection ring for TiltSurface and outer panels that wrap art + labels (setup/run tiles).
export const tiltSurfaceSelectedRingClass = "ring-2 ring-primary ring-offset-4 ring-offset-background";

export const tooltipAnchorClassNames = {
  above: "bottom-full mb-4",
  below: "top-full mt-4 bottom-auto",
} as const;

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
