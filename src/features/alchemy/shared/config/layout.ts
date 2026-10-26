// Share the hero's inner art height, allowing for the Surface's 1px border on each side.
export const battleActorSizingStyle = {
  "--battle-hero-width": "calc(19.5075 * var(--content-rem, 1rem))",
  "--battle-portrait-height": "calc((var(--battle-hero-width) - 2px) * 4 / 3)",
  "--battle-static-enemy-width": "calc(34.6815 * var(--content-rem, 1rem))",
  "--battle-animated-enemy-width": "calc(var(--battle-portrait-height) * 16 / 9 + 2px)",
};
export const battleCardWidthClass = "w-[var(--battle-hero-width)]";
export const battleAnimatedEnemyCardWidthClass = "w-[var(--battle-animated-enemy-width)]";
export const battlePortraitHeightClass = "h-[var(--battle-portrait-height)]";

export const battleCompanionWidthClass = "w-[calc(12.6225*var(--content-rem,1rem))]";

export const battleCompanionCornerClass =
  "absolute bottom-0 left-full z-20 -translate-x-[42%] translate-y-[calc(1.08*var(--content-rem,1rem))]";

export const battleEnemyCardWidthClass = "w-[var(--battle-static-enemy-width,calc(34.6815*var(--content-rem,1rem)))]";
export const handCardWidthClass = "w-[var(--hand-card-width)]";

export const collectionCardGridTileWidthClass = "mx-auto w-full max-w-[calc(15.282*var(--content-rem,1rem))]";

export const viewCardWidthClass = "w-[calc(14.4045*var(--content-rem,1rem))]";
export const collectionTileWidthClass = "w-[calc(17.2868*var(--content-rem,1rem))]";

export const battleTrinketInspectRowMaxWidthClass =
  "mx-auto w-fit max-w-[min(100%,calc(107.478*var(--content-rem,1rem)))]";

export const collectionGridTileWidthClass = "mx-auto w-full max-w-[calc(17.2868*var(--content-rem,1rem))]";
export const collectionGridGapXClass = "gap-x-5";

export const collectionShellWidthClass = "max-w-[calc(80*var(--content-rem,1rem))]";

export const collectionGridBestiaryWidthClass = "mx-auto w-full max-w-[calc(25.8323*var(--content-rem,1rem))]";

export const COLLECTION_CARD_REFERENCE_WIDTH = 244.512;
export const COLLECTION_BESTIARY_REFERENCE_WIDTH = 390;
// Collection keeps at most two rows with the same column caps on every display.
export const COLLECTION_CARD_MAX_COLUMNS = 4;
export const COLLECTION_BESTIARY_MAX_COLUMNS = 3;

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
export const cardArtFrameClass = `${cardSurfaceClass} card-art-frame border border-border/80`;

export const cardInteractiveGlowClass = "card-interactive-glow";

export const cardHoverScaleClass = "card-hover-scale";
export const screenShellPaddingClass = "p-[calc(2.1*var(--content-rem,1rem))]";

export const chooserLockedSurfaceClass = "cursor-not-allowed opacity-45 grayscale";

export const lockedHoverPreviewClass =
  "opacity-45 grayscale focus-navigation:group-focus-within:opacity-100 focus-navigation:group-focus-within:grayscale-0 group-hover:opacity-100 group-hover:grayscale-0";

export const chooserLockedHoverSurfaceClass = `cursor-not-allowed ${lockedHoverPreviewClass}`;

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

export const tooltipWidthClass = "w-fit max-w-80";

export const surfaceSelectedRingClass = "card-interactive-selected";

export const tooltipAnchorClassNames = {
  above: "bottom-full mb-4",
  below: "top-full mt-4 bottom-auto",
} as const;

// The grid anchors the facing edges around the gap. A quarter of the width
// difference balances the portrait centers, preserving their sizes and gap.
export const battleActorSectionClass = {
  desktop:
    "battle-actor-pair absolute inset-x-0 grid grid-cols-2 -translate-y-1/2 translate-x-[calc((var(--battle-hero-width)_-_var(--battle-enemy-width))_/_4)] items-start px-4 gap-[clamp(10cqw,14cqw,18cqw)]",
  ultrawide:
    "battle-actor-pair absolute inset-x-0 grid grid-cols-2 -translate-y-1/2 translate-x-[calc((var(--battle-hero-width)_-_var(--battle-enemy-width))_/_4)] items-start px-4 gap-[clamp(12cqw,16cqw,20cqw)]",
} as const;

export const battleActorHeroCellClass =
  "relative flex items-start justify-end transition-transform duration-500 ease-out";
export const battleActorEnemyCellClass = "relative flex items-start justify-start";

// The previous inset scene lost 5.5 content rem to page and battle padding.
// Retain that height cap so moving the dock does not enlarge hands or piles.
export const battleBottomBarClass =
  "[--hand-card-width:min(calc(16.5038*var(--content-rem,1rem)),calc((100cqh_-_5.5*var(--content-rem,1rem))*0.2445))] absolute inset-x-[calc(1.125*var(--content-rem,1rem))] bottom-[calc(1.125*var(--content-rem,1rem))] flex justify-center items-end gap-[clamp(1.25cqw,3cqw,2.19cqw)]";

export const battleBottomColumnClass =
  "relative flex shrink-0 w-[calc(var(--hand-card-width)*0.8)] flex-col items-center justify-end gap-4";

export const battleHandContainerClass =
  "flex min-w-0 items-end justify-center min-h-[calc((100cqh_-_5.5*var(--content-rem,1rem))*0.3337)] px-[calc(var(--hand-card-width)*0.32)] pt-10";

export const pileCardWidthClass = "w-[calc(var(--hand-card-width)*0.8)]";
