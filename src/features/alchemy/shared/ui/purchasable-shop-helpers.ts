export function getShopPurchaseState(price: number, gold: number, purchased: boolean) {
  const canAfford = gold >= price;
  const canPurchase = !purchased && canAfford;
  return { canAfford, canPurchase };
}

export type ShopPurchaseState = ReturnType<typeof getShopPurchaseState>;

export function getShopItemAriaLabel(title: string, purchased: boolean): string {
  return purchased ? title : `Buy ${title}`;
}
