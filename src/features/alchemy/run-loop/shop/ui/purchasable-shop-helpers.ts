import { text } from "@/lib/localization/runtime";
export function getShopPurchaseState(price: number, gold: number, purchased: boolean) {
  const canAfford = gold >= price;
  const canPurchase = !purchased && canAfford;
  return { canAfford, canPurchase };
}

export type ShopPurchaseState = ReturnType<typeof getShopPurchaseState>;

export function getShopItemAriaLabel(title: string, price: number, purchased: boolean, canAfford: boolean): string {
  return purchased
    ? text("shop.item-purchased", "{{title}}. Purchased", { title })
    : canAfford
      ? text("shop.buy", "Buy {{title}} for {{price}} Gold", { title, price })
      : text("shop.buy-unaffordable", "Buy {{title}} for {{price}} Gold. Not enough Gold", { title, price });
}
