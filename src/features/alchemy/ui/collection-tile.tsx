// Single interactive collection tile for card, bestiary, and trinket entries.
// Depends on tile item data, card flipping, tooltip components, audio, and tilt utilities.
// Used by CollectionGrid to keep grid layout separate from tile behavior.
import { useState, type CSSProperties } from "react";

import { playCardSound, playEnemyAttack } from "@/lib/audio";
import { cardBack } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  cardArtImageClass,
  cardSurfaceClass,
  collectionTileWidthClass,
  squareArtImageClass,
  trinketCardWidthClass,
} from "../config";
import { CardFlip } from "./card-flip";
import { DetailPopup } from "./card-popup";
import type { CollectionTileItem } from "./collection-items";
import { EnemyTooltip } from "./enemy-tooltip";
import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";

type CompendiumTileProps = {
  item: CollectionTileItem;
  wrapperStyle?: CSSProperties;
};

export function CompendiumTile({ item, wrapperStyle }: CompendiumTileProps) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    item.hoverScope,
    item.id,
  );
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="stagger-item relative" style={wrapperStyle} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      <CollectionTilePopup item={item} hovered={isHovered} />
      <TiltSurface
        as="button"
        ariaLabel={item.discovered ? `Inspect ${item.title}` : "Inspect Undiscovered Entry"}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        className={cn(
          "group w-full",
          cardSurfaceClass,
          item.frameType === "trinket" ? trinketCardWidthClass : collectionTileWidthClass,
          item.frameType === "card" && "bg-transparent",
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
}

function CollectionTilePopup({ item, hovered }: { item: CollectionTileItem; hovered: boolean }) {
  if (!hovered) return null;
  if (item.frameType === "bestiary" && item.enemyEntry) {
    return <EnemyTooltip entry={item.enemyEntry} discovered={item.discovered} />;
  }
  return (
    <DetailPopup
      idPrefix={item.id}
      title={item.title}
      subtitle={item.subtitle}
      descriptionLines={item.descriptionLines}
    />
  );
}

function CollectionTileMedia({ item, flipped }: { item: CollectionTileItem; flipped: boolean }) {
  if (item.frameType === "card") {
    return (
      <CardFlip
        flipped={flipped}
        className="w-full aspect-[3/4]"
        front={<TileImage item={item} className={cn("h-full", cardArtImageClass)} />}
        back={<img src={cardBack} alt="" aria-hidden="true" className={cn("block h-full w-full", cardArtImageClass)} />}
      />
    );
  }

  return <TileImage item={item} className={item.frameType === "trinket" ? squareArtImageClass : cardArtImageClass} />;
}

function TileImage({ item, className }: { item: CollectionTileItem; className: string }) {
  return (
    <img
      src={item.art}
      alt={item.title}
      className={cn(
        "block w-full transition duration-300",
        className,
        item.discovered ? "opacity-100" : "grayscale opacity-45",
      )}
      loading="eager"
    />
  );
}
