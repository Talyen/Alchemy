import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { EquippedTrinkets } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { collectionGridTileWidthClass, gearArtAspectClass } from "@/features/alchemy/shared/config";
import { TrinketTile } from "@/features/alchemy/shared/ui/collection-art-tiles";
import { PagedPickerGrid, useArmoryPickerPage } from "./paged-picker-grid";

export function TrinketPickerGrid({
  characterId,
  trinkets,
  equippedTrinkets,
  editable,
  onEquip,
}: {
  characterId: CharacterId;
  trinkets: TrinketEntry[];
  equippedTrinkets: EquippedTrinkets;
  editable: boolean;
  onEquip: (trinketId: string) => void;
}) {
  const pageContext = `trinket:${characterId}`;
  const { pageItems, fillerCount, safePage, totalPages, onPageChange } = useArmoryPickerPage(pageContext, trinkets);

  return (
    <PagedPickerGrid
      testId="armory-trinket-picker"
      swapKey={characterId}
      isEmpty={trinkets.length === 0}
      safePage={safePage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      fillerCount={fillerCount}
      fillerClassName={cn(collectionGridTileWidthClass, gearArtAspectClass)}
    >
      {pageItems.map((trinket) => {
        const equippedBy = (Object.entries(equippedTrinkets) as Array<[CharacterId, string | null]>).find(
          ([, id]) => id === trinket.id,
        )?.[0];
        return (
          <div key={trinket.id} data-testid="armory-trinket-item" data-trinket-id={trinket.id} className="relative">
            <TrinketTile
              trinket={trinket}
              interactionKey="armory-trinket"
              as="button"
              className={collectionGridTileWidthClass}
              disabled={!editable}
              interactiveChrome={editable}
              onClick={editable ? () => onEquip(trinket.id) : undefined}
              ariaLabel={`Equip ${trinket.title}${equippedBy ? ` from ${equippedBy}` : ""}`}
            />
          </div>
        );
      })}
    </PagedPickerGrid>
  );
}
