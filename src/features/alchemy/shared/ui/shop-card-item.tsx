// Shop card controls for purchasing and selecting cards.
// Depends on card button/title rendering and shared gold/disabled controls.
// Used by merchant, alchemist, corruption, mystery, and remove panels.
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
  const canAfford = gold >= price;

  const media = (
    <BattleCardButton
      card={card}
      onClick={!purchased && canAfford ? onBuy : undefined}
      disabled={purchased || !canAfford}
      ariaLabel={purchased ? getCardDisplayTitle(card) : `Buy ${getCardDisplayTitle(card)}`}
      shimmerActive={false}
      shimmerToken={undefined}
      className={cn(widthClass, !purchased && canAfford && cardInteractiveGlowClass)}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </BattleCardButton>
  );

  return <PurchasableShopTile media={media} purchased={purchased} />;
}

export type SelectableCardChrome = "shop" | "deck" | "corruption";

type SelectableShopCardProps = {
  card: BattleCard;
  isSelected: boolean;
  onSelect: () => void;
  chrome?: SelectableCardChrome;
  widthClass?: string;
} & (
  | { isHovered?: undefined; onHoverStart?: undefined; onHoverEnd?: undefined }
  | { isHovered: boolean; onHoverStart: () => void; onHoverEnd: () => void }
);

export function SelectableShopCard(props: SelectableShopCardProps) {
  const { card, isSelected, onSelect, chrome = "shop", widthClass } = props;
  const resolvedWidth = widthClass ?? (chrome === "shop" ? collectionTileWidthClass : viewCardWidthClass);

  const buttonProps = {
    card,
    onClick: onSelect,
    ariaLabel: `Select ${getCardDisplayTitle(card)}`,
    shimmerActive: false,
    shimmerToken: undefined,
    className: cn(
      resolvedWidth,
      cardInteractiveGlowClass,
      chrome === "corruption" && isSelected && "card-interactive-selected-danger",
    ),
    selected: chrome === "corruption" ? false : isSelected,
  };

  // Controlled callers (mystery deck pickers) bind the full hover trio so a
  // selection can keep its detail popup open; everyone else gets the button's
  // internal hover tracking.
  if (props.onHoverStart !== undefined) {
    return (
      <BattleCardButton
        {...buttonProps}
        hovered={props.isHovered}
        onHoverStart={props.onHoverStart}
        onHoverEnd={props.onHoverEnd}
      />
    );
  }
  return <BattleCardButton {...buttonProps} />;
}
