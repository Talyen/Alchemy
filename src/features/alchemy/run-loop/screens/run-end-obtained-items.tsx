import { trinketById } from "@/lib/game-data";
import type { RunObtainedItem } from "@/lib/active-run-session";
import { cn } from "@/lib/utils";
import { GearTile, TrinketTile } from "../../shared/ui/collection-art-tiles";
import { FadeSlot } from "../../shared/ui/use-fade";
import { FlankingPagination } from "../../shared/ui/navigation";
import { usePaginatedRows } from "../../shared/ui/use-paginated-rows";

const ITEM_PAGE_SIZE = 4;
const ITEM_COLUMNS = 4;
const RUN_END_ITEM_WIDTH = "w-[calc(13.8308*var(--content-rem,1rem))]";

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
  return <div className={cn(RUN_END_ITEM_WIDTH, "[&>*>*]:!w-full")}>{tile}</div>;
}
