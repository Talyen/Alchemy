// Shop card controls for purchasing and selecting cards.
// Depends on card button/title rendering and shared gold/disabled controls.
// Used by merchant, alchemist, corruption, mystery, and remove panels.
import { useState } from "react";

import { type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardInteractiveGlowClass, collectionTileWidthClass, viewCardWidthClass } from "../config";
import { BattleCardButton } from "./card-button";
import { getCardDisplayTitle } from "./card-description-ui";
import { PurchasableShopTile, ShopPriceChip } from "./purchasable-shop-tile";

interface PurchasableCardItemProps {
  card: BattleCard;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
  widthClass?: string;
}

export function PurchasableCardItem(props: PurchasableCardItemProps) {
  const { card, price, gold, purchased, onBuy, widthClass = collectionTileWidthClass } = props;
  const [hovered, setHovered] = useState(false);
  const canAfford = gold >= price;

  const media = (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <BattleCardButton
        card={card}
        hovered={hovered}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={!purchased && canAfford ? onBuy : undefined}
        disabled={purchased || !canAfford}
        ariaLabel={purchased ? getCardDisplayTitle(card) : `Buy ${getCardDisplayTitle(card)}`}
        shimmerActive={false}
        shimmerToken={undefined}
        className={cn(widthClass, !purchased && canAfford && cardInteractiveGlowClass)}
      >
        <ShopPriceChip price={price} gold={gold} purchased={purchased} />
      </BattleCardButton>
    </div>
  );

  return <PurchasableShopTile media={media} price={price} gold={gold} purchased={purchased} onBuy={onBuy} />;
}

export type SelectableCardChrome = "shop" | "deck" | "corruption";

export function SelectableShopCard({
  card,
  isSelected,
  onSelect,
  chrome = "shop",
  widthClass,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: {
  card: BattleCard;
  isSelected: boolean;
  onSelect: () => void;
  chrome?: SelectableCardChrome;
  widthClass?: string;
  isHovered?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}) {
  const [localHovered, setLocalHovered] = useState(false);
  const resolvedWidth = widthClass ?? (chrome === "shop" ? collectionTileWidthClass : viewCardWidthClass);
  const hovered = isHovered ?? (chrome === "deck" ? isSelected || localHovered : localHovered);
  const handleHoverStart = onHoverStart ?? (() => setLocalHovered(true));
  const handleHoverEnd = onHoverEnd ?? (() => setLocalHovered(false));

  return (
    <BattleCardButton
      card={card}
      hovered={hovered}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      onClick={onSelect}
      ariaLabel={`Select ${getCardDisplayTitle(card)}`}
      shimmerActive={false}
      shimmerToken={undefined}
      className={cn(
        resolvedWidth,
        cardInteractiveGlowClass,
        chrome === "corruption" && isSelected && "card-interactive-selected-danger",
      )}
      selected={chrome === "corruption" ? false : isSelected}
    />
  );
}
