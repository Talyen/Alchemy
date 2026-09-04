import { memo, useState, type RefObject } from "react";

import { playCardSound, playEnemyAttack } from "@/lib/audio";
import { cardBack, getEffectiveCardDescriptionLines } from "@/lib/game-data";
import { gearDefinitions, getGearDefinitionShineColors } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";

import {
  cardArtImageClass,
  cardInteractiveGlowClass,
  cardShineFrameClass,
  cardSurfaceClass,
  getTileWidthClass,
  getTrinketShineColors,
  getPlasmaColorPairForCard,
  getPlasmaColorPairForTrinket,
  getPlasmaColorPairForUnique,
  landscapeArtImageClass,
  trinketArtImageClass,
} from "../config";
import { CardFlip } from "./card-flip";
import { DetailPopup } from "./card-popup";
import type { CollectionTileItem } from "./collection-items";
import { EnemyTooltip } from "./enemy-tooltip";
import { GearItemTitle, TrinketItemTitle } from "./gear-item-title";
import { HeroTooltip } from "./hero-tooltip";
import { Surface } from "./surface";
import { useInteractiveCard } from "./use-interactive-card";
import { useTileHoverPopup } from "./use-tile-hover-popup";

interface CollectionTileProps {
  item: CollectionTileItem;
}

export const CollectionTile = memo(function CollectionTile({ item }: CollectionTileProps) {
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

  const shineColors = collectionTileShineColors(item);
  const showShine = shineColors.length > 0;

  return (
    <div
      ref={wrapperRef}
      className="relative flex h-full w-full justify-center"
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleMouseLeave}
    >
      {showPopup ? <CollectionTilePopup item={item} hovered={isHovered} triggerRef={wrapperRef} /> : null}
      <Surface
        as="button"
        ariaLabel={inspectAriaLabel(item)}
        onFocus={handleHoverStart}
        onBlur={handleBlur}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        className={cn(
          "group shadow-md",
          showShine && cardShineFrameClass,
          !showShine && "border border-border/80",
          cardSurfaceClass,
          cardInteractiveGlowClass,
          getTileWidthClass(item.frameType === "bestiary" ? "bestiary" : "collectionCard"),
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
        {showShine ? <ShineBorder shineColor={shineColors} borderWidth={2} className="z-20" /> : null}
      </Surface>
    </div>
  );
});

function collectionTileShineColors(item: CollectionTileItem): readonly string[] {
  if (!item.discovered) return [];
  if (item.frameType === "trinket") return getTrinketShineColors(item.id);
  if (item.frameType === "unique") {
    const definition = gearDefinitions[item.id];
    return definition ? getGearDefinitionShineColors(definition) : [];
  }
  return [];
}

function inspectAriaLabel(item: CollectionTileItem): string {
  if (item.frameType === "hero") {
    return item.discovered ? `Inspect ${item.title}` : `Inspect ${item.title} (Locked)`;
  }
  return item.discovered ? `Inspect ${item.title}` : "Inspect Undiscovered Entry";
}

function CollectionTilePopup({
  item,
  hovered,
  triggerRef,
}: {
  item: CollectionTileItem;
  hovered: boolean;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  if (item.frameType === "hero" && item.character) {
    return (
      <HeroTooltip
        character={item.character}
        isLocked={!item.discovered}
        unlockRequirementText={item.unlockRequirementText ?? ""}
        triggerRef={triggerRef}
        visible={hovered}
      />
    );
  }
  if (item.frameType === "bestiary" && item.enemyEntry) {
    return (
      <EnemyTooltip entry={item.enemyEntry} discovered={item.discovered} triggerRef={triggerRef} visible={hovered} />
    );
  }
  const descriptionLines =
    item.card && hovered
      ? getEffectiveCardDescriptionLines(item.card, { companionBondLevels: item.companionBondLevels ?? {} })
      : item.descriptionLines;
  const uniqueDefinition = item.frameType === "unique" ? gearDefinitions[item.id] : undefined;
  const title =
    item.frameType === "trinket" && item.discovered ? (
      <TrinketItemTitle trinket={{ id: item.id, title: item.title }} />
    ) : item.frameType === "unique" && item.discovered && uniqueDefinition ? (
      <GearItemTitle definition={uniqueDefinition} />
    ) : (
      item.title
    );
  return (
    <DetailPopup
      idPrefix={item.id}
      title={title}
      subtitle={item.subtitle}
      descriptionLines={descriptionLines}
      triggerRef={triggerRef}
      visible={hovered}
      plasmaColorPair={
        !item.discovered
          ? null
          : item.card
            ? getPlasmaColorPairForCard(item.card)
            : item.frameType === "trinket"
              ? getPlasmaColorPairForTrinket(item.id)
              : item.frameType === "unique"
                ? getPlasmaColorPairForUnique()
                : null
      }
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
        back={<img src={cardBack} alt="" className={cn("block h-full w-full", cardArtImageClass)} />}
      />
    );
  }

  return (
    <TileImage
      item={item}
      className={cn(
        item.frameType === "trinket" || item.frameType === "unique"
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
        item.discovered
          ? "opacity-100"
          : "opacity-45 grayscale group-focus-within:opacity-100 group-focus-within:grayscale-0 group-hover:opacity-100 group-hover:grayscale-0",
      )}
    />
  );
}
