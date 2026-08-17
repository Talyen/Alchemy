// Shared card sizing and surface classes for battle, collection, and popup card UI.

// These clamp() CSS values size cards from the virtual stage rather than the
// browser viewport so preview emulation and desktop scaling stay consistent.
// Pixel bounds converted to cqh/cqw so the layout is resolution-independent
// (the stage container may be 1080, 2160, or another height in the future).
export const battleCardWidthClass = "w-[clamp(28.5cqh,28.9cqh,43.1cqh)]";
/** Slightly larger than 1/√3 of hero width so the companion reads as a corner portrait. */
export const battleCompanionWidthClass = "w-[clamp(18.4cqh,18.7cqh,27.9cqh)]";
/** Peek over the hero art bottom-right: ~42% on the portrait, dipped onto the art border but above HP. */
export const battleCompanionCornerClass = "absolute bottom-0 left-full z-20 -translate-x-[42%] translate-y-[1.6cqh]";
/** Landscape enemy art sized to match portrait hero height (3:4 width × 16/9). */
export const battleEnemyCardWidthClass = "w-[clamp(50.67cqh,51.38cqh,76.62cqh)]";
export const handCardWidthClass = "w-[clamp(24.06cqh,24.45cqh,36.43cqh)]";
// Collection card tiles keep an independent clamp; max-width so 4-col rows shrink instead of overlapping.
export const collectionCardGridTileWidthClass = "mx-auto w-full max-w-[clamp(22.28cqh,22.64cqh,33.73cqh)]";
// Non-battle card/tile widths are authored ~1.2× denser than the prior stage sizes.
export const viewCardWidthClass = "w-[clamp(21cqh,21.34cqh,31.78cqh)]"; // was 17.5 / 17.78 / 26.48
export const collectionTileWidthClass = "w-[clamp(25.2cqh,25.61cqh,38.14cqh)]"; // was 21 / 21.34 / 31.78
/** Four reward-sized trinket tiles + `gap-x-6` — caps inspect rows so paging stays 4×2. */
export const battleTrinketInspectRowMaxWidthClass = "mx-auto w-fit max-w-[min(100%,calc(4*38.14cqh+3*1.5rem))]";
// Grid cells use max-width so densified tiles shrink instead of overlapping neighbors when
// the shell is narrower than 4×tile + gaps (e.g. rem-fixed max-w after UI Scale removal).
export const collectionGridTileWidthClass = "mx-auto w-full max-w-[clamp(25.2cqh,25.61cqh,38.14cqh)]";
export const collectionGridGapXClass = "gap-x-5";
// Must fit 4× collection card max (hand clamp) + 3× gap-x-5 + ScreenShell p-[2.1rem] at 1080cqh (~1.2kpx).
export const collectionShellWidthClass = "max-w-7xl";
// Shared with CollectionGrid — stretch columns; tiles self-center via collectionGrid*WidthClass.
export const collectionCardGridClass = `grid w-full ${collectionGridGapXClass} grid-cols-4`;
export const collectionTrinketGridClass = `grid w-full ${collectionGridGapXClass} grid-cols-4`;
export const collectionBestiaryGridClass = `grid w-full ${collectionGridGapXClass} grid-cols-3`;
/** Landscape 4:3 tiles sized to maximize enemy portrait size while matching the cards tab height. */
export const collectionGridBestiaryWidthClass = "mx-auto w-full max-w-[clamp(36cqh,38.27cqh,40.25cqh)]";
/** Floor for Collection FadeSlot so pagination does not jump across tab aspect ratios. */
export const collectionGridMinHeightClass = "min-h-[64cqh]";
export const pileCardWidthClass = "w-[clamp(13.8cqh,14.9cqh,21cqh)]";

/** Landscape chooser art (destination). Caps at the designed size; shrinks with the tile. */
export const chooserArtWidthClass = "w-full max-w-[39.11cqh]";
/** Game mode select art — slightly larger than destination chooser tiles. */
export const gameModeArtWidthClass = "w-full max-w-[43cqh]";
/**
 * Standalone landscape art (mystery event intro). Same cap as chooser tiles, but a definite
 * width: aspect frames whose clip layer is `position:absolute` collapse to 0×0 under `w-full`
 * in a shrink-wrapped `items-center` column.
 */
export const standaloneLandscapeArtWidthClass = "w-[min(100%,39.11cqh)]";
/** Flex item for a padded 3-up chooser tile (`px-5`). Grows up to art+padding, shrinks when the row is tight. */
export const chooserPaddedTileClass = "relative min-w-0 w-full max-w-[calc(39.11cqh+2.5rem)] flex-1";
export const gameModePaddedTileClass = "relative min-w-0 w-full max-w-[calc(43cqh+2.5rem)] flex-1";
export const chooserRowGapClass = "gap-5";
/**
 * ScreenShell ceiling for a 3-up landscape chooser with padded tiles.
 * 3×(art + px-5) + 2×gap-5 + ScreenShell p-[2.1rem]; `min(100%)` never exceeds the page.
 */
export const chooserRowShellWidthClass = "max-w-[min(100%,calc(3*39.11cqh+3*2.5rem+2*1.25rem+4.2rem))]";
export const gameModeRowShellWidthClass = "max-w-[min(100%,calc(3*43cqh+3*2.5rem+2*1.25rem+4.2rem))]";

/** Portrait chooser art (character select). Caps at the designed size; shrinks with the tile. */
export const chooserHeroArtWidthClass = "w-full max-w-[25.5cqh]";
export const chooserHeroRowGapClass = "gap-x-8";
/**
 * ScreenShell ceiling for a 4-up portrait chooser.
 * 4×art + 3×gap-x-8 + ScreenShell p-[2.1rem]; `min(100%)` never exceeds the page.
 */
export const chooserHeroRowShellWidthClass = "max-w-[min(100%,calc(4*25.5cqh+3*2rem+4.2rem))]";
/** Flex item for a padded 4-up portrait chooser tile (`px-4`). Grows up to art+padding, shrinks when the row is tight. */
export const chooserHeroPaddedTileClass = "relative min-w-0 w-full max-w-[calc(25.5cqh+2rem)] flex-1";
/**
 * ScreenShell ceiling for a padded 4-up portrait chooser (difficulty select).
 * 4×(art + px-4) + 3×gap-5 + ~1rem divider + ScreenShell p-[2.1rem]; `min(100%)` never exceeds the page.
 */
export const chooserHeroPaddedRowShellWidthClass = "max-w-[min(100%,calc(4*(25.5cqh+2rem)+3*1.25rem+1rem+4.2rem))]";

// Card and popup surfaces stay centralized so repeated game widgets share the
// same tactile fantasy material treatment.
export const cardSurfaceClass = "relative overflow-hidden rounded-shell-hero bg-black";

/**
 * Hover/focus chrome for interactive cards and tiles.
 * Glow is a drop-shadow (follows rounded alpha); do not use ring/box-shadow here —
 * those paint a rectangular halo once the tile is a 3D compositor layer.
 */
export const cardInteractiveGlowClass = "card-interactive-glow";
/** Marks a tile whose shine overlay replaces the 3px hover/select border. */
export const cardShineFrameClass = "has-shine-border";

export const cardArtImageClass = "rounded-shell-hero aspect-[3/4] object-cover";

export const trinketArtImageClass = "rounded-shell-hero aspect-[3/4] object-cover";
export const trinketArtTileClass = `${cardSurfaceClass} ${collectionTileWidthClass} aspect-[3/4]`;
export const trinketArtFillClass = "absolute inset-0 h-full w-full";
export const landscapeArtImageClass = "rounded-shell-hero aspect-[4/3] object-cover";
/** Shop / reward / collection gear frames — portrait art, not grid footprint. */
export const gearArtAspectClass = "aspect-[3/4]";
export const gearArtFillClass = "absolute inset-0 h-full w-full rounded-shell-hero object-cover";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";
export const popupBaseClassName =
  "absolute left-1/2 z-50 rounded-shell-tooltip border border-border bg-card px-3 py-3 text-left";

// Standard hover tooltip width: content-sized up to a 288px cap. Tiny tooltips
// shrink to their content; none exceed the cap.
export const tooltipWidthClass = "w-fit max-w-72";

// Selection chrome — same primary border + glow as hover (see `.card-interactive-selected`).
export const tiltSurfaceSelectedRingClass = "card-interactive-selected";

export const tooltipAnchorClassNames = {
  above: "bottom-full mb-4",
  below: "top-full mt-4 bottom-auto",
} as const;

// Half-stage anchors: fight axis (inner edges + gap) on screen center. Extra landscape
// width grows into the right half instead of translating the pair as one object.
export const battleActorSectionClass = {
  desktop:
    "absolute inset-x-0 grid grid-cols-2 -translate-y-1/2 -translate-x-[2cqw] items-start px-4 gap-[clamp(10cqw,14cqw,18cqw)]",
  ultrawide:
    "absolute inset-x-0 grid grid-cols-2 -translate-y-1/2 -translate-x-[2cqw] items-start px-4 gap-[clamp(12cqw,16cqw,20cqw)]",
} as const;

export const battleActorHeroCellClass =
  "relative flex items-start justify-end transition-transform duration-500 ease-out";
export const battleActorEnemyCellClass = "relative flex items-start justify-start";

export const battleBottomBarClass =
  "absolute inset-x-0 grid items-end gap-[clamp(1.25cqw,3cqw,2.19cqw)] px-2 bottom-2 grid-cols-[minmax(10.19cqh,0.24fr)_1fr_minmax(10.19cqh,0.24fr)] pb-1";

export const battleBottomColumnClass = "flex flex-col items-center justify-end gap-4 pb-4";

export const battleHandContainerClass = "flex min-w-0 items-end justify-center min-h-[33.37cqh] pb-3 pt-10";
