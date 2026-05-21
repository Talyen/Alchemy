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
  staticCardTransform,
  trinketCardWidthClass,
} from "../config";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";
import { CardFlip } from "./card-flip";
import { DetailPopup } from "./card-popup";
import type { CollectionTileItem } from "./collection-items";
import { EnemyTooltip } from "./enemy-tooltip";
import { ShimmerOverlay } from "./shared-ui";

type CompendiumTileProps = {
  item: CollectionTileItem;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  wrapperStyle?: CSSProperties;
};

export function CompendiumTile(props: CompendiumTileProps) {
  const { item, hovered, onHoverStart, onHoverEnd, wrapperStyle } = props;
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="stagger-item relative" style={wrapperStyle} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      <CollectionTilePopup item={item} hovered={hovered} />
      <button
        type="button"
        aria-label={item.discovered ? `Inspect ${item.title}` : "Inspect Undiscovered Entry"}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        onClick={() => {
          if (item.hoverScope === "collection-card") {
            playCardSound(item.id);
            setFlipped((f) => !f);
          } else if (item.hoverScope === "collection-bestiary") {
            playEnemyAttack(item.id);
          }
        }}
        className={getTileButtonClassName(item)}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <ShimmerOverlay active={props.shimmerActive} token={props.shimmerToken} />
        <CollectionTileMedia item={item} flipped={flipped} />
      </button>
    </div>
  );
}

function CollectionTilePopup({ item, hovered }: Pick<CompendiumTileProps, "item" | "hovered">) {
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
        front={<TileImage item={item} className={`h-full ${cardArtImageClass}`} />}
        back={<img src={cardBack} alt="" aria-hidden="true" className={`block h-full w-full ${cardArtImageClass}`} />}
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

function getTileButtonClassName(item: CollectionTileItem) {
  return cn(
    "tilt-surface group w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    cardSurfaceClass,
    item.frameType === "trinket" ? trinketCardWidthClass : collectionTileWidthClass,
    item.frameType === "card" && "bg-transparent",
  );
}
