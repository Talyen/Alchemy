// Run-end recap of permanent Gear and Armory Trinkets obtained during the run.
import { trinketById } from "@/lib/game-data";
import type { RunObtainedItem } from "@/lib/active-run-session";
import { GearTile, TrinketTile } from "../../shared/ui/collection-art-tiles";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { FlankingPagination } from "../../shared/ui/navigation";
import { usePaginatedRows } from "../../shared/ui/use-paginated-rows";

const ITEM_PAGE_SIZE = 4;
const ITEM_COLUMNS = 4;
const RUN_END_ITEM_WIDTH = "w-[clamp(20.16cqh,20.49cqh,30.51cqh)]";

export function RunEndObtainedItems({ items }: { items: readonly RunObtainedItem[] }) {
  const { page, totalPages, pageItems, setPage } = usePaginatedRows(items, ITEM_PAGE_SIZE, ITEM_COLUMNS);
  if (items.length === 0) return null;

  const paging = totalPages > 1;

  return (
    <FlankingPagination page={page} totalPages={totalPages} onPageChange={setPage}>
      <FadeSlot swapKey={`run-end-items-${page}`} className={paging ? "min-h-[34cqh]" : undefined}>
        <div className="flex w-full flex-wrap items-center justify-center gap-4">
          {pageItems.map((item) => (
            <RunEndObtainedItemTile key={obtainedItemKey(item)} item={item} />
          ))}
        </div>
      </FadeSlot>
    </FlankingPagination>
  );
}

function obtainedItemKey(item: RunObtainedItem): string {
  return item.kind === "gear" ? `gear:${item.instance.instanceId}` : `trinket:${item.trinketId}`;
}

function RunEndObtainedItemTile({ item }: { item: RunObtainedItem }) {
  let tile;
  if (item.kind === "gear") {
    tile = <GearTile instance={item.instance} interactionKey="run-end-item" />;
  } else {
    const trinket = trinketById[item.trinketId];
    if (!trinket) return null;
    tile = <TrinketTile trinket={trinket} interactionKey="run-end-item" />;
  }
  return <div className={`${RUN_END_ITEM_WIDTH} [&>*>*]:!w-full`}>{tile}</div>;
}
