export const battleCardWidthClass = "w-[calc(19.5075*var(--content-rem,1rem))]";

export const battleCompanionWidthClass = "w-[calc(12.6225*var(--content-rem,1rem))]";

export const battleCompanionCornerClass =
  "absolute bottom-0 left-full z-20 -translate-x-[42%] translate-y-[calc(1.08*var(--content-rem,1rem))]";

export const battleEnemyCardWidthClass = "w-[calc(34.6815*var(--content-rem,1rem))]";
export const handCardWidthClass = "w-[var(--hand-card-width)]";

export const collectionCardGridTileWidthClass = "mx-auto w-full max-w-[calc(15.282*var(--content-rem,1rem))]";

export const viewCardWidthClass = "w-[calc(14.4045*var(--content-rem,1rem))]";
export const collectionTileWidthClass = "w-[calc(17.2868*var(--content-rem,1rem))]";

export const battleTrinketInspectRowMaxWidthClass =
  "mx-auto w-fit max-w-[min(100%,calc(107.478*var(--content-rem,1rem)))]";

export const collectionGridTileWidthClass = "mx-auto w-full max-w-[calc(17.2868*var(--content-rem,1rem))]";
export const collectionGridGapXClass = "gap-x-5";
export const artTileGridRowsClass = "grid-rows-2 gap-y-8";

export const collectionShellWidthClass = "max-w-[1280px]";

export const collectionGridBestiaryWidthClass = "mx-auto w-full max-w-[calc(25.8323*var(--content-rem,1rem))]";

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
export const pileCardWidthClass = "w-[calc(10.0575*var(--content-rem,1rem))]";

export const chooserArtWidthClass = "w-full max-w-[calc(26.3993*var(--content-rem,1rem))]";

export const gameModeArtWidthClass = "w-full max-w-[calc(29.025*var(--content-rem,1rem))]";

export const standaloneLandscapeArtWidthClass = "w-[min(100%,calc(26.3993*var(--content-rem,1rem)))]";

export const chooserPaddedTileClass = "relative min-w-0 w-full max-w-[calc(28.8993*var(--content-rem,1rem))] flex-1";
export const gameModePaddedTileClass = "relative min-w-0 w-full max-w-[calc(31.525*var(--content-rem,1rem))] flex-1";
export const chooserRowGapClass = "gap-5";

export const chooserRowShellWidthClass = "max-w-[min(100%,calc(93.3979*var(--content-rem,1rem)))]";
export const gameModeRowShellWidthClass = "max-w-[min(100%,calc(101.275*var(--content-rem,1rem)))]";

export const chooserHeroArtWidthClass = "w-full max-w-[calc(17.2125*var(--content-rem,1rem))]";
export const chooserHeroRowGapClass = "gap-x-8";

export const chooserHeroRowShellWidthClass = "max-w-[min(100%,calc(79.05*var(--content-rem,1rem)))]";

export const chooserHeroPaddedTileClass =
  "relative min-w-0 w-full max-w-[calc(19.2125*var(--content-rem,1rem))] flex-1";

export const chooserHeroPaddedRowShellWidthClass = "max-w-[min(100%,calc(85.8*var(--content-rem,1rem)))]";

export const cardSurfaceClass = "relative overflow-hidden rounded-shell-hero bg-black";

export const cardInteractiveGlowClass = "card-interactive-glow";

export const cardHoverScaleClass = "card-hover-scale";
export const screenShellPaddingClass = "p-[calc(2.1*var(--content-rem,1rem))]";

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
export const tooltipChromeClass = "z-50 rounded-shell-tooltip border border-border bg-card px-3 py-3 text-left";
export const popupBaseClassName = `absolute left-1/2 ${tooltipChromeClass}`;

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

export const battleHandContainerClass =
  "flex min-w-0 items-end justify-center min-h-[33.37cqh] [--hand-card-width:min(calc(16.5038*var(--content-rem,1rem)),24.45cqh)] px-[calc(var(--hand-card-width)/2)] pt-10";
