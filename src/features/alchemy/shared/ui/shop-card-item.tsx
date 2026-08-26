// Shop card controls for purchasing cards.
// Depends on card button/title rendering and shared gold/disabled controls.
// Used by merchant, alchemist, corruption, mystery, and remove panels.
// Card *selection* chrome lives in selectable-card.tsx.
import { type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardInteractiveGlowClass, collectionTileWidthClass } from "../config";
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
  const canPurchase = !purchased && canAfford;

  const media = (
    <BattleCardButton
      card={card}
      onClick={canPurchase ? onBuy : undefined}
      disabled={!canPurchase}
      ariaLabel={purchased ? getCardDisplayTitle(card) : `Buy ${getCardDisplayTitle(card)}`}
      shimmerActive={false}
      shimmerToken={undefined}
      className={cn(widthClass, canPurchase && cardInteractiveGlowClass)}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </BattleCardButton>
  );

  return <PurchasableShopTile media={media} purchased={purchased} />;
}
