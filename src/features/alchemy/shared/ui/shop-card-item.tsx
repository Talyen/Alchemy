// Shop card controls for purchasing and selecting cards.
// Depends on card button/title rendering and shared gold/disabled controls.
// Used by merchant and alchemist screens.
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { BattleCard } from "@/lib/game-data";

import { collectionTileWidthClass } from "../config";
import { BattleCardButton } from "./card-button";
import { CardTitle, getCardDisplayTitle } from "./card-description-ui";
import { DisabledTooltip, GoldCost, StaggerItem } from "./shared-ui";

interface PurchasableCardItemProps {
  card: BattleCard;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
  widthClass?: string;
  staggerIndex?: number;
}

export function PurchasableCardItem(props: PurchasableCardItemProps) {
  const { card, price, gold, purchased, onBuy, widthClass = collectionTileWidthClass, staggerIndex } = props;
  const [hovered, setHovered] = useState(false);

  if (purchased) {
    return (
      <PurchasedCardItem
        card={card}
        widthClass={widthClass}
        {...(staggerIndex !== undefined ? { staggerIndex } : {})}
      />
    );
  }

  const content = (
    <div className="flex flex-col items-center gap-3 rounded-shell-card border border-border/70 bg-card/60 p-4 text-center">
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <BattleCardButton
          card={card}
          hovered={hovered}
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          ariaLabel={`Inspect ${getCardDisplayTitle(card)}`}
          shimmerActive={false}
          shimmerToken={undefined}
          className={widthClass}
        />
      </div>
      <p className="text-sm font-semibold text-foreground">
        <CardTitle card={card} />
      </p>
      <DisabledTooltip show={gold < price} message="Not Enough Gold">
        <Button variant="outline" disabled={gold < price} onClick={onBuy}>
          Buy <GoldCost amount={price} />
        </Button>
      </DisabledTooltip>
    </div>
  );

  if (staggerIndex !== undefined) {
    return <StaggerItem index={staggerIndex}>{content}</StaggerItem>;
  }
  return content;
}

function PurchasedCardItem({
  card,
  widthClass,
  staggerIndex,
}: Pick<PurchasableCardItemProps, "card"> & { widthClass: string; staggerIndex?: number }) {
  const content = (
    <div className="flex flex-col items-center gap-3 rounded-shell-card border border-border/30 bg-card/30 p-4 text-center opacity-50">
      <BattleCardButton
        card={card}
        hovered={false}
        onHoverStart={() => {}}
        onHoverEnd={() => {}}
        ariaLabel={getCardDisplayTitle(card)}
        shimmerActive={false}
        shimmerToken={undefined}
        className={widthClass}
        disabled
      />
      <p className="text-sm font-semibold text-amber-100/75">
        <CardTitle card={card} />
      </p>
      <span className="text-xs font-semibold text-muted-foreground">Purchased</span>
    </div>
  );

  if (staggerIndex !== undefined) {
    return <StaggerItem index={staggerIndex}>{content}</StaggerItem>;
  }
  return content;
}

export function SelectableShopCard({
  card,
  isSelected,
  onSelect,
}: {
  card: BattleCard;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <BattleCardButton
      card={card}
      hovered={hovered}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onSelect}
      ariaLabel={`Select ${getCardDisplayTitle(card)}`}
      shimmerActive={false}
      shimmerToken={undefined}
      className={collectionTileWidthClass}
      selected={isSelected}
    />
  );
}
