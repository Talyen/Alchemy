import { ShopShelf, type ShopShelfProps } from "./shop-shelf";

export function TrinketShopScreen(props: ShopShelfProps<"trinket">) {
  const empty = props.items.length === 0;
  return (
    <ShopShelf
      {...props}
      kind="trinket"
      title="Trinket Shop"
      refreshesLeft={empty ? 0 : props.refreshesLeft}
      extraServices={empty ? <p role="status">All Trinkets have been collected.</p> : undefined}
    />
  );
}
