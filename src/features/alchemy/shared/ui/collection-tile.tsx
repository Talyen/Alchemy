// Single interactive collection tile for card, bestiary, and boon entries.
// Depends on tile item data, card flipping, tooltip components, audio, and shared surface styling.
// Used by CollectionGrid to keep grid layout separate from tile behavior.
import { memo, useState, type RefObject } from "react";

import { playCardSound, playEnemyAttack } from "@/lib/audio";
import { cardBack } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  cardArtImageClass,
  cardInteractiveGlowClass,
  cardSurfaceClass,
  collectionCardGridTileWidthClass,
  collectionGridBestiaryWidthClass,
  landscapeArtImageClass,
  trinketArtImageClass,
} from "../config";
import { getEffectiveCardDescriptionLines } from "@/lib/game-data";
import { CardFlip } from "./card-flip";
import { DetailPopup } from "./card-popup";
import type { CollectionTileItem } from "./collection-items";
import { EnemyTooltip } from "./enemy-tooltip";
import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";
import { useTileHoverPopup } from "./use-tile-hover-popup";

interface CompendiumTileProps {
  item: CollectionTileItem;
}

export const CompendiumTile = memo(function CompendiumTile({ item }: CompendiumTileProps) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    item.hoverScope,
    item.id,
  );
  const [flipped, setFlipped] = useState(false);
  const { wrapperRef, showPopup, handleHoverStart, handleMouseLeave, handleBlur } = useTileHoverPopup({
    interactive: true,
    isHovered,
    onHoverStart,
    onHoverEnd,
  });

  return (
    <div
      ref={wrapperRef}
      className="relative flex h-full w-full justify-center"
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleMouseLeave}
    >
      {showPopup ? <CollectionTilePopup item={item} hovered={isHovered} triggerRef={wrapperRef} /> : null}
      <TiltSurface
        as="button"
        ariaLabel={item.discovered ? `Inspect ${item.title}` : "Inspect Undiscovered Entry"}
        onFocus={handleHoverStart}
        onBlur={handleBlur}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        className={cn(
          "group border border-border/80 shadow-md",
          cardSurfaceClass,
          cardInteractiveGlowClass,
          item.frameType === "trinket"
            ? collectionCardGridTileWidthClass
            : item.frameType === "bestiary"
              ? collectionGridBestiaryWidthClass
              : collectionCardGridTileWidthClass,
        )}
        onClick={() => {
          if (item.hoverScope === "collection-card") {
            playCardSound(item.id);
            setFlipped((f) => !f);
          } else if (item.hoverScope === "collection-bestiary") {
            playEnemyAttack(item.id);
          }
        }}
      >
        <CollectionTileMedia item={item} flipped={flipped} />
      </TiltSurface>
    </div>
  );
});

function CollectionTilePopup({
  item,
  hovered,
  triggerRef,
}: {
  item: CollectionTileItem;
  hovered: boolean;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  if (item.frameType === "bestiary" && item.enemyEntry) {
    return (
      <EnemyTooltip entry={item.enemyEntry} discovered={item.discovered} triggerRef={triggerRef} visible={hovered} />
    );
  }
  const descriptionLines =
    item.card && hovered
      ? getEffectiveCardDescriptionLines(item.card, { companionBondLevels: item.companionBondLevels ?? {} })
      : item.descriptionLines;
  return (
    <DetailPopup
      idPrefix={item.id}
      title={item.title}
      subtitle={item.subtitle}
      descriptionLines={descriptionLines}
      triggerRef={triggerRef}
      visible={hovered}
    />
  );
}

function CollectionTileMedia({ item, flipped }: { item: CollectionTileItem; flipped: boolean }) {
  if (item.frameType === "card") {
    return (
      <CardFlip
        flipped={flipped}
        className="aspect-[3/4] w-full"
        front={<TileImage item={item} className={cn("h-full", cardArtImageClass)} />}
        back={<img src={cardBack} className={cn("block h-full w-full", cardArtImageClass)} />}
      />
    );
  }

  return (
    <TileImage
      item={item}
      className={cn(
        item.frameType === "trinket"
          ? trinketArtImageClass
          : item.frameType === "bestiary"
            ? landscapeArtImageClass
            : cardArtImageClass,
      )}
    />
  );
}

function TileImage({ item, className }: { item: CollectionTileItem; className: string }) {
  return (
    <img
      src={item.art || undefined}
      alt={item.title}
      className={cn(
        "block w-full transition duration-300",
        className,
        item.discovered ? "opacity-100" : "opacity-45 grayscale",
      )}
    />
  );
}
