import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { shopItemSlotKey } from "../shop/shop-slot-keys";
import { PurchasableCardItem, PurchasableGearItem, PurchasableTrinketItem } from "../shop/ui/purchasable-shop-item";
import { GenericShopScreen, type GenericShopScreenProps } from "./generic-shop-screen";

interface ShopItems {
  card: BattleCard;
  gear: GearInstance;
  trinket: TrinketEntry;
}

/** Every shop uses the same shelf contract; services remain with their screens. */
export type ShopShelfProps<K extends keyof ShopItems> = Omit<
  GenericShopScreenProps<ShopItems[K]>,
  "title" | "getSlotKey" | "renderItem"
>;

type Props = {
  [K in keyof ShopItems]: ShopShelfProps<K> & { kind: K; title: string };
}[keyof ShopItems];

export function ShopShelf(props: Props) {
  switch (props.kind) {
    case "card":
      return (
        <GenericShopScreen
          {...props}
          getSlotKey={(card, index) => shopItemSlotKey(card.id, index)}
          renderItem={(card, price, purchased, onBuy) => (
            <PurchasableCardItem card={card} price={price} gold={props.gold} purchased={purchased} onBuy={onBuy} />
          )}
        />
      );
    case "gear":
      return (
        <GenericShopScreen
          {...props}
          getSlotKey={(gear) => gear.instanceId}
          renderItem={(instance, price, purchased, onBuy) => (
            <PurchasableGearItem
              instance={instance}
              price={price}
              gold={props.gold}
              purchased={purchased}
              onBuy={onBuy}
            />
          )}
        />
      );
    case "trinket":
      return (
        <GenericShopScreen
          {...props}
          getSlotKey={(trinket, index) => shopItemSlotKey(trinket.id, index)}
          renderItem={(trinket, price, purchased, onBuy) => (
            <PurchasableTrinketItem
              trinket={trinket}
              price={price}
              gold={props.gold}
              purchased={purchased}
              onBuy={onBuy}
            />
          )}
        />
      );
  }
}
