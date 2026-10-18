import { useGameTranslation } from "@/components/use-game-translation";

import type { ReactNode } from "react";

import { text } from "@/lib/localization/runtime";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { getGearInstanceTitle } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { cardInteractiveGlowClass, getTileWidthClass, getCardInspectionShineColors } from "../../../shared/config";
import { BattleCardButton } from "../../../shared/ui/cards/card-button";
import { getCardDisplayTitle } from "../../../shared/ui/cards/card-description-ui";
import { GearTile, TrinketTile } from "../../../shared/ui/collection-art-tiles";
import { ShopPriceChip } from "./purchasable-shop-tile";

interface BasePurchasableProps {
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
}

function getShopItemAriaLabel(title: string, price: number, purchased: boolean, canAfford: boolean): string {
  return purchased
    ? text("shop.item-purchased", "{{title}}. Purchased", { title })
    : canAfford
      ? text("shop.buy", "Buy {{title}} for {{price}} Gold", { title, price })
      : text("shop.buy-unaffordable", "Buy {{title}} for {{price}} Gold. Not enough Gold", { title, price });
}

interface MediaControls {
  canPurchase: boolean;
  label: string;
  chip: ReactNode;
}

function PurchasableFrame({
  title,
  price,
  gold,
  purchased,
  renderMedia,
}: Omit<BasePurchasableProps, "onBuy"> & {
  title: string;
  renderMedia: (controls: MediaControls) => ReactNode;
}) {
  const i18n = useGameTranslation();
  const canAfford = gold >= price;
  const canPurchase = !purchased && canAfford;
  return (
    <div className={cn("relative flex flex-col items-center text-center", purchased && "opacity-50")}>
      {renderMedia({
        canPurchase,
        label: i18n.displayText(i18n.read(() => getShopItemAriaLabel(title, price, purchased, canAfford))),
        chip: <ShopPriceChip price={price} purchased={purchased} canAfford={canAfford} />,
      })}
    </div>
  );
}

export function PurchasableCardItem({
  card,
  price,
  gold,
  purchased,
  onBuy,
  widthClass = getTileWidthClass("collection"),
}: BasePurchasableProps & { card: BattleCard; widthClass?: string }) {
  return (
    <PurchasableFrame
      title={getCardDisplayTitle(card)}
      price={price}
      gold={gold}
      purchased={purchased}
      renderMedia={({ canPurchase, label, chip }) => (
        <BattleCardButton
          card={card}
          onClick={canPurchase ? onBuy : undefined}
          ariaDisabled={!canPurchase}
          ariaLabel={label}
          shimmerActive={false}
          shimmerToken={undefined}
          shineColor={canPurchase ? getCardInspectionShineColors(card) : undefined}
          className={cn(widthClass, canPurchase ? cardInteractiveGlowClass : "cursor-default grayscale")}
        >
          {chip}
        </BattleCardButton>
      )}
    />
  );
}

export function PurchasableGearItem({
  instance,
  price,
  gold,
  purchased,
  onBuy,
}: BasePurchasableProps & { instance: GearInstance }) {
  const i18n = useGameTranslation();
  return (
    <PurchasableFrame
      title={i18n.displayText(getGearInstanceTitle(instance))}
      price={price}
      gold={gold}
      purchased={purchased}
      renderMedia={({ canPurchase, label, chip }) => (
        <GearTile
          instance={instance}
          interactionKey="shop"
          as="button"
          shine={!purchased}
          ariaDisabled={!canPurchase}
          onClick={canPurchase ? onBuy : undefined}
          ariaLabel={label}
        >
          {chip}
        </GearTile>
      )}
    />
  );
}

export function PurchasableTrinketItem({
  trinket,
  price,
  gold,
  purchased,
  onBuy,
}: BasePurchasableProps & { trinket: TrinketEntry }) {
  const i18n = useGameTranslation();
  return (
    <PurchasableFrame
      title={i18n.displayText(trinket.title)}
      price={price}
      gold={gold}
      purchased={purchased}
      renderMedia={({ canPurchase, label, chip }) => (
        <TrinketTile
          trinket={trinket}
          interactionKey="shop"
          as="button"
          shine={!purchased}
          ariaDisabled={!canPurchase}
          onClick={canPurchase ? onBuy : undefined}
          ariaLabel={label}
        >
          {chip}
        </TrinketTile>
      )}
    />
  );
}
