import { Fragment, useState, type ReactNode } from "react";
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
  isProgressSavePending?: () => boolean;
  extraServices?: ReactNode;
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
  isProgressSavePending = () => false,
  extraServices,
  renderItem,
}: GenericShopScreenProps<T>) {
  const shelfKey = shopOfferingsSwapKey(
    items.map((it, i) => getSlotKey(it, i)),
    refreshesLeft,
  );
  const [failedShelf, setFailedShelf] = useState<string | null>(null);
  return (
    <ShopBrowseShell title={title} gold={gold}>
      {failedShelf === shelfKey && (
        <p role="alert" className="text-center">
          Could not complete this purchase. Check the current stock, price, and your Gold, then try again.
        </p>
      )}
      <ShopBrowseOfferings
        swapKey={shelfKey}
        onLeave={onContinue}
        services={
          <>
            {extraServices}
            <RefreshShopServiceButton
              gold={gold}
              refreshesLeft={refreshesLeft}
              refreshPrice={refreshPrice}
              onRefresh={onRefresh}
            />
          </>
        }
      >
        {items.map((item, i) => {
          const slotKey = getSlotKey(item, i);
          const purchased = purchasedSlotKeys.includes(slotKey);
          const price = getPrice(item);
          return (
            <Fragment key={slotKey}>
              {renderItem(item, price, purchased, () => {
                if (!isProgressSavePending()) setFailedShelf(onBuy(item, slotKey) ? null : shelfKey);
              })}
            </Fragment>
          );
        })}
      </ShopBrowseOfferings>
    </ShopBrowseShell>
  );
}
