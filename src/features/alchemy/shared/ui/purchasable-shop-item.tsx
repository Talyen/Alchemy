import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { getGearInstanceTitle } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { cardInteractiveGlowClass, getTileWidthClass } from "../config";
import { BattleCardButton } from "./card-button";
import { getCardDisplayTitle } from "./card-description-ui";
import { GearTile, TrinketTile } from "./collection-art-tiles";
import { getShopItemAriaLabel, getShopPurchaseState } from "./purchasable-shop-helpers";
import { PurchasableShopTile, ShopPriceChip } from "./purchasable-shop-tile";

interface BasePurchasableProps {
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
}

export function PurchasableCardItem({
  card,
  price,
  gold,
  purchased,
  onBuy,
  widthClass = getTileWidthClass("collection"),
}: BasePurchasableProps & { card: BattleCard; widthClass?: string }) {
  const purchaseState = getShopPurchaseState(price, gold, purchased);
  const { canPurchase } = purchaseState;
  const media = (
    <BattleCardButton
      card={card}
      onClick={canPurchase ? onBuy : undefined}
      disabled={!canPurchase}
      ariaLabel={getShopItemAriaLabel(getCardDisplayTitle(card), purchased)}
      shimmerActive={false}
      shimmerToken={undefined}
      className={cn(widthClass, canPurchase && cardInteractiveGlowClass)}
    >
      <ShopPriceChip price={price} purchased={purchased} purchaseState={purchaseState} />
    </BattleCardButton>
  );
  return <PurchasableShopTile media={media} purchased={purchased} />;
}

export function PurchasableGearItem({
  instance,
  price,
  gold,
  purchased,
  onBuy,
}: BasePurchasableProps & { instance: GearInstance }) {
  const purchaseState = getShopPurchaseState(price, gold, purchased);
  const { canPurchase } = purchaseState;
  const media = (
    <GearTile
      instance={instance}
      interactionKey="shop"
      as="button"
      shine={!purchased}
      interactiveChrome={!purchased}
      disabled={!canPurchase}
      onClick={canPurchase ? onBuy : undefined}
      ariaLabel={getShopItemAriaLabel(getGearInstanceTitle(instance), purchased)}
    >
      <ShopPriceChip price={price} purchased={purchased} purchaseState={purchaseState} />
    </GearTile>
  );
  return <PurchasableShopTile media={media} purchased={purchased} />;
}

export function PurchasableTrinketItem({
  trinket,
  price,
  gold,
  purchased,
  onBuy,
}: BasePurchasableProps & { trinket: TrinketEntry }) {
  const purchaseState = getShopPurchaseState(price, gold, purchased);
  const { canPurchase } = purchaseState;
  const media = (
    <TrinketTile
      trinket={trinket}
      interactionKey="shop"
      as="button"
      shine={!purchased}
      interactiveChrome={!purchased}
      disabled={!canPurchase}
      onClick={canPurchase ? onBuy : undefined}
      ariaLabel={getShopItemAriaLabel(trinket.title, purchased)}
    >
      <ShopPriceChip price={price} purchased={purchased} purchaseState={purchaseState} />
    </TrinketTile>
  );
  return <PurchasableShopTile media={media} purchased={purchased} />;
}
