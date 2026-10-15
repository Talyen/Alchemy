import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText } from "@/lib/localization/runtime";
import { ShopShelf, type ShopShelfProps } from "./shop-shelf";

export function TrinketShopScreen(props: ShopShelfProps<"trinket">) {
  useGameTranslation();
  const empty = props.items.length === 0;
  return (
    <ShopShelf
      {...props}
      kind="trinket"
      title={gameText("ui.trinket-shop-screen.1", "Trinket Shop")}
      refreshesLeft={empty ? 0 : props.refreshesLeft}
      extraServices={
        empty ? (
          <p role="status">{gameText("ui.trinket-shop-screen.2", "All Trinkets have been collected.")}</p>
        ) : undefined
      }
    />
  );
}
