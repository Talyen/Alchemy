import { memo, useState, type RefObject } from "react";

import { playCardSound, playEnemyAttack } from "@/lib/audio";
import { cardBack, getEffectiveCardDescriptionLines, getCardKeywords } from "@/lib/game-data";
import { gearDefinitions } from "@/lib/gear";
import { getTrinketKeywords, cardById } from "../../../shared/config/game-data-catalog";
import { cn } from "@/lib/utils";
import { extractKeywordIds } from "@/lib/keyword-text";
import { ShineBorder } from "@/components/ui/shine-border";

import {
  cardArtImageClass,
  cardInteractiveGlowClass,
  cardSurfaceClass,
  getTileWidthClass,
  getInspectionKeywordShineColors,
  getCharacterShineColors,
  getPlasmaKeywordsForEnemy,
  getPlasmaColorPairForCard,
  getPlasmaColorPairForTrinket,
  getPlasmaColorPairForUnique,
  landscapeArtImageClass,
  trinketArtImageClass,
} from "../../../shared/config";
import { CardFlip } from "../../../shared/ui/card-flip";
import { DetailPopup } from "../../../shared/ui/tooltips/card-popup";
import type { CollectionTileItem } from "./collection-items";
import { EnemyTooltip } from "../../../shared/ui/tooltips/enemy-tooltip";
import { GearItemTitle, TrinketItemTitle } from "../../../shared/ui/gear-item-title";
import { HeroTooltip } from "../../../shared/ui/tooltips/hero-tooltip";
import { Surface } from "../../../shared/ui/surface";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";
import { useTileHoverPopup } from "../../../shared/ui/use-tile-hover-popup";

interface CollectionTileProps {
  item: CollectionTileItem;
  onEnemyActivate?: ((enemyId: string, trigger: HTMLButtonElement) => void) | undefined;
  inspectionOpen?: boolean;
}

export const CollectionTile = memo(function CollectionTile({
  item,
  onEnemyActivate,
  inspectionOpen = false,
}: CollectionTileProps) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    item.hoverScope,
    item.id,
  );
  const [flipped, setFlipped] = useState(false);
  const { wrapperRef, showPopup, visible, handleHoverStart, handleMouseMove, handleMouseLeave, handleBlur, dismiss } =
    useTileHoverPopup({
      interactive: true,
      suspended: inspectionOpen,
      isHovered,
      onHoverStart,
      onHoverEnd,
    });

  const shineColors = collectionTileShineColors(item);
  const showShine = visible && shineColors.length > 0;

  return (
    <div
      ref={wrapperRef}
      className="relative flex h-full w-full justify-center"
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {showPopup ? <CollectionTilePopup item={item} hovered={visible} triggerRef={wrapperRef} /> : null}
      <Surface
        as="button"
        ariaLabel={inspectAriaLabel(item)}
        onFocus={handleHoverStart}
        onBlur={handleBlur}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        overlay={showShine ? <ShineBorder glow shineColor={shineColors} borderWidth={2} className="z-20" /> : null}
        className={cn(
          "group card-art-frame border border-border/80 shadow-md",
          showShine && "card-art-shine",
          cardSurfaceClass,
          cardInteractiveGlowClass,
          getTileWidthClass(item.frameType === "bestiary" ? "bestiary" : "collectionCard"),
        )}
        onClick={(event) => {
          if (item.hoverScope === "collection-card") {
            playCardSound(item.id);
            setFlipped((f) => !f);
          } else if (item.hoverScope === "collection-bestiary") {
            if (item.discovered) dismiss();
            playEnemyAttack(item.id);
            onEnemyActivate?.(item.id, event.currentTarget);
          }
        }}
      >
        <CollectionTileMedia item={item} flipped={flipped} />
      </Surface>
    </div>
  );
});

function collectionTileShineColors(item: CollectionTileItem): readonly string[] {
  if (item.card) return getInspectionKeywordShineColors(getCardKeywords(item.card));
  if (item.frameType === "card") {
    const catalogCard = cardById[item.id];
    if (catalogCard) return getInspectionKeywordShineColors(getCardKeywords(catalogCard));
  }
  if (item.character) return getCharacterShineColors(item.character.id);
  if (item.enemyEntry) return getInspectionKeywordShineColors(getPlasmaKeywordsForEnemy(item.enemyEntry));
  if (item.frameType === "trinket") return getInspectionKeywordShineColors(getTrinketKeywords(item.id));
  if (item.frameType === "unique") {
    const definition = gearDefinitions[item.id];
    return definition ? getInspectionKeywordShineColors(extractKeywordIds(definition.descriptionLines.join(" "))) : [];
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
