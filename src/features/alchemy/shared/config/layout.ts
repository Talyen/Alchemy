export const battleCardWidthClass = "w-[clamp(28.5cqh,28.9cqh,43.1cqh)]";

export const battleCompanionWidthClass = "w-[clamp(18.4cqh,18.7cqh,27.9cqh)]";

export const battleCompanionCornerClass = "absolute bottom-0 left-full z-20 -translate-x-[42%] translate-y-[1.6cqh]";

export const battleEnemyCardWidthClass = "w-[clamp(50.67cqh,51.38cqh,76.62cqh)]";
export const handCardWidthClass = "w-[clamp(24.06cqh,24.45cqh,36.43cqh)]";

export const collectionCardGridTileWidthClass = "mx-auto w-full max-w-[clamp(22.28cqh,22.64cqh,33.73cqh)]";

export const viewCardWidthClass = "w-[clamp(21cqh,21.34cqh,31.78cqh)]";
export const collectionTileWidthClass = "w-[clamp(25.2cqh,25.61cqh,38.14cqh)]";

export const battleTrinketInspectRowMaxWidthClass = "mx-auto w-fit max-w-[min(100%,calc(4*38.14cqh+3*1.5rem))]";

export const collectionGridTileWidthClass = "mx-auto w-full max-w-[clamp(25.2cqh,25.61cqh,38.14cqh)]";
export const collectionGridGapXClass = "gap-x-5";

export const collectionShellWidthClass = "max-w-7xl";

export const collectionCardGridClass = `grid w-full ${collectionGridGapXClass} grid-cols-4`;
export const collectionTrinketGridClass = `grid w-full ${collectionGridGapXClass} grid-cols-4`;
export const collectionBestiaryGridClass = `grid w-full ${collectionGridGapXClass} grid-cols-3`;

export const collectionGridBestiaryWidthClass = "mx-auto w-full max-w-[clamp(36cqh,38.27cqh,40.25cqh)]";

export type TileWidthVariant = "collection" | "view" | "bestiary" | "collectionCard";

export function getTileWidthClass(variant: TileWidthVariant): string {
  switch (variant) {
    case "collection":
      return collectionTileWidthClass;
    case "view":
      return viewCardWidthClass;
    case "bestiary":
      return collectionGridBestiaryWidthClass;
    case "collectionCard":
      return collectionCardGridTileWidthClass;
    default:
      return collectionTileWidthClass;
  }
}

export const collectionGridMinHeightClass = "min-h-[64cqh]";
export const pileCardWidthClass = "w-[clamp(13.8cqh,14.9cqh,21cqh)]";

export const chooserArtWidthClass = "w-full max-w-[39.11cqh]";

export const gameModeArtWidthClass = "w-full max-w-[43cqh]";

export const standaloneLandscapeArtWidthClass = "w-[min(100%,39.11cqh)]";

export const chooserPaddedTileClass = "relative min-w-0 w-full max-w-[calc(39.11cqh+2.5rem)] flex-1";
export const gameModePaddedTileClass = "relative min-w-0 w-full max-w-[calc(43cqh+2.5rem)] flex-1";
export const chooserRowGapClass = "gap-5";

export const chooserRowShellWidthClass = "max-w-[min(100%,calc(3*39.11cqh+3*2.5rem+2*1.25rem+4.2rem))]";
export const gameModeRowShellWidthClass = "max-w-[min(100%,calc(3*43cqh+3*2.5rem+2*1.25rem+4.2rem))]";

export const chooserHeroArtWidthClass = "w-full max-w-[25.5cqh]";
export const chooserHeroRowGapClass = "gap-x-8";

export const chooserHeroRowShellWidthClass = "max-w-[min(100%,calc(4*25.5cqh+3*2rem+4.2rem))]";

export const chooserHeroPaddedTileClass = "relative min-w-0 w-full max-w-[calc(25.5cqh+2rem)] flex-1";

export const chooserHeroPaddedRowShellWidthClass = "max-w-[min(100%,calc(4*(25.5cqh+2rem)+3*1.25rem+1rem+4.2rem))]";

export const cardSurfaceClass = "relative overflow-hidden rounded-shell-hero bg-black";

export const cardInteractiveGlowClass = "card-interactive-glow";

export const cardHoverScaleClass = "card-hover-scale";
export const screenShellPaddingClass = "p-[2.1rem]";

export const settingsPanelShellClass = "rounded-shell-panel border border-border/70 p-5 surface-muted";

export const chooserLockedSurfaceClass = "cursor-not-allowed opacity-45 grayscale";

export const cardShineFrameClass = "has-shine-border";

export const cardArtImageClass = "rounded-shell-hero aspect-[3/4] object-cover";

export const trinketArtImageClass = "rounded-shell-hero aspect-[3/4] object-cover";
export const trinketArtTileClass = `${cardSurfaceClass} ${collectionTileWidthClass} aspect-[3/4]`;
export const trinketArtFillClass = "absolute inset-0 h-full w-full";
export const landscapeArtImageClass = "rounded-shell-hero aspect-[4/3] object-cover";

export const gearArtAspectClass = "aspect-[3/4]";
export const gearArtFillClass = "absolute inset-0 h-full w-full rounded-shell-hero object-cover";
export const staticCardTransform = "translate3d(0px, 0px, 0px)";
export const popupBaseClassName =
  "absolute left-1/2 z-50 rounded-shell-tooltip border border-border bg-card px-3 py-3 text-left";

export const tooltipWidthClass = "w-fit max-w-72";

export const surfaceSelectedRingClass = "card-interactive-selected";

export const tooltipAnchorClassNames = {
  above: "bottom-full mb-4",
  below: "top-full mt-4 bottom-auto",
} as const;

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
