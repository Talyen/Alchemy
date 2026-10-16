import { useGameTranslation } from "@/components/use-game-translation";

import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { getGearInstanceTitle } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { cardInteractiveGlowClass, getTileWidthClass, getCardInspectionShineColors } from "../../../shared/config";
import { BattleCardButton } from "../../../shared/ui/cards/card-button";
import { getCardDisplayTitle } from "../../../shared/ui/cards/card-description-ui";
import { GearTile, TrinketTile } from "../../../shared/ui/collection-art-tiles";
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
  const i18n = useGameTranslation();
  const purchaseState = getShopPurchaseState(price, gold, purchased);
  const { canPurchase } = purchaseState;
  const media = (
    <BattleCardButton
      card={card}
      onClick={canPurchase ? onBuy : undefined}
      ariaDisabled={!canPurchase}
      ariaLabel={i18n.displayText(
        i18n.read(() => getShopItemAriaLabel(getCardDisplayTitle(card), price, purchased, purchaseState.canAfford)),
      )}
      shimmerActive={false}
      shimmerToken={undefined}
      shineColor={canPurchase ? getCardInspectionShineColors(card) : undefined}
      className={cn(widthClass, canPurchase ? cardInteractiveGlowClass : "cursor-default grayscale")}
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
  const i18n = useGameTranslation();
  const purchaseState = getShopPurchaseState(price, gold, purchased);
  const { canPurchase } = purchaseState;
  const media = (
    <GearTile
      instance={instance}
      interactionKey="shop"
      as="button"
      shine={!purchased}
      ariaDisabled={!canPurchase}
      onClick={canPurchase ? onBuy : undefined}
      ariaLabel={i18n.displayText(
        i18n.read(() =>
          getShopItemAriaLabel(
            i18n.displayText(getGearInstanceTitle(instance)),
            price,
            purchased,
            purchaseState.canAfford,
          ),
        ),
      )}
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
  const i18n = useGameTranslation();
  const purchaseState = getShopPurchaseState(price, gold, purchased);
  const { canPurchase } = purchaseState;
  const media = (
    <TrinketTile
      trinket={trinket}
      interactionKey="shop"
      as="button"
      shine={!purchased}
      ariaDisabled={!canPurchase}
      onClick={canPurchase ? onBuy : undefined}
      ariaLabel={i18n.displayText(
        i18n.read(() =>
          getShopItemAriaLabel(i18n.displayText(trinket.title), price, purchased, purchaseState.canAfford),
        ),
      )}
    >
      <ShopPriceChip price={price} purchased={purchased} purchaseState={purchaseState} />
    </TrinketTile>
  );
  return <PurchasableShopTile media={media} purchased={purchased} />;
}
