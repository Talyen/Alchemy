import { useGameTranslation } from "@/components/use-game-translation";

import { ShopShelf, type ShopShelfProps } from "./shop-shelf";

export function EquipmentShopScreen(props: ShopShelfProps<"gear">) {
  const i18n = useGameTranslation();
  return <ShopShelf {...props} kind="gear" title={i18n.text("ui.equipment-shop-screen.1", "Gear Shop")} />;
}
