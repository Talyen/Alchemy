import { ShopShelf, type ShopShelfProps } from "./shop-shelf";

export function EquipmentShopScreen(props: ShopShelfProps<"gear">) {
  return <ShopShelf {...props} kind="gear" title="Gear Shop" />;
}
