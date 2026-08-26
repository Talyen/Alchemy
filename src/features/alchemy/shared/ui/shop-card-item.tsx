import { type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardInteractiveGlowClass, collectionTileWidthClass } from "../config";
import { BattleCardButton } from "./card-button";
import { getCardDisplayTitle } from "./card-description-ui";
import { getShopItemAriaLabel, getShopPurchaseState } from "./purchasable-shop-helpers";
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
  const { canPurchase } = getShopPurchaseState(price, gold, purchased);
  const cardTitle = getCardDisplayTitle(card);

  const media = (
    <BattleCardButton
      card={card}
      onClick={canPurchase ? onBuy : undefined}
      disabled={!canPurchase}
      ariaLabel={getShopItemAriaLabel(cardTitle, purchased)}
      shimmerActive={false}
      shimmerToken={undefined}
      className={cn(widthClass, canPurchase && cardInteractiveGlowClass)}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </BattleCardButton>
  );

  return <PurchasableShopTile media={media} purchased={purchased} />;
}
