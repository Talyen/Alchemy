import { Fragment, type ReactNode } from "react";
import { shopOfferingsSwapKey } from "../shop/shop-slot-keys";
import { RefreshShopServiceButton, ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";

interface GenericShopScreenProps<T> {
  title: string;
  gold: number;
  items: T[];
  refreshesLeft: number;
  refreshPrice: number;
  purchasedSlotKeys: string[];
  getSlotKey: (item: T, index: number) => string;
  getPrice: (item: T) => number;
  onBuy: (item: T, slotKey: string) => boolean;
  onRefresh: () => void;
  onContinue: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
  renderItem: (item: T, price: number, purchased: boolean, onBuy: () => void) => ReactNode;
}

export function GenericShopScreen<T>({
  title,
  gold,
  items,
  refreshesLeft,
  refreshPrice,
  purchasedSlotKeys,
  getSlotKey,
  getPrice,
  onBuy,
  onRefresh,
  onContinue,
  onOpenMenu,
  renderItem,
}: GenericShopScreenProps<T>) {
  return (
    <ShopBrowseShell title={title} gold={gold} onOpenMenu={onOpenMenu}>
      <ShopBrowseOfferings
        swapKey={shopOfferingsSwapKey(
          items.map((it, i) => getSlotKey(it, i)),
          refreshesLeft,
        )}
        onLeave={onContinue}
        services={
          <RefreshShopServiceButton
            gold={gold}
            refreshesLeft={refreshesLeft}
            refreshPrice={refreshPrice}
            onRefresh={onRefresh}
          />
        }
      >
        {items.map((item, i) => {
          const slotKey = getSlotKey(item, i);
          const purchased = purchasedSlotKeys.includes(slotKey);
          const price = getPrice(item);
          return <Fragment key={slotKey}>{renderItem(item, price, purchased, () => onBuy(item, slotKey))}</Fragment>;
        })}
      </ShopBrowseOfferings>
    </ShopBrowseShell>
  );
}
