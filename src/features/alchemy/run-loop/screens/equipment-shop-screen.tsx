import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
import { ShopShelf, type ShopShelfProps } from "./shop-shelf";

export function EquipmentShopScreen(props: ShopShelfProps<"gear">) {
  useGameTranslation();
  return <ShopShelf {...props} kind="gear" title={gameText("ui.equipment-shop-screen.1", "Gear Shop")} />;
}
