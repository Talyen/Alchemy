import { Lock } from "lucide-react";
import { characters } from "@/features/alchemy/shared/config/game-data-catalog";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { EquippedTrinkets } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { collectionGridTileWidthClass, gearArtAspectClass } from "@/features/alchemy/shared/config";
import { TrinketTile } from "@/features/alchemy/shared/ui/collection-art-tiles";
import { PagedPickerGrid, useArmoryPickerPage } from "./paged-picker-grid";

export function TrinketPickerGrid({
  reservedTrinkets,
  characterId,
  trinkets,
  equippedTrinkets,
  editable,
  onEquip,
}: {
  reservedTrinkets: Record<string, CharacterId>;
  characterId: CharacterId;
  trinkets: TrinketEntry[];
  equippedTrinkets: EquippedTrinkets;
  editable: boolean;
  onEquip: (trinketId: string) => void;
}) {
  const pageContext = `trinket:${characterId}`;
  const { grid, pageItems, fillerCount, safePage, totalPages, onPageChange } = useArmoryPickerPage(
    pageContext,
    trinkets,
    trinkets.findIndex((item) => item.id === equippedTrinkets[characterId]),
  );

  return (
    <PagedPickerGrid
      grid={grid}
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
        const reservedBy = reservedTrinkets[trinket.id];
        const reservationReason = reservedBy
          ? `Reserved for ${characters[reservedBy].name} until their battle ends.`
          : undefined;
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
              ariaDisabled={!editable || Boolean(reservedBy)}
              chip={reservationReason}
              interactiveChrome={editable && !reservedBy}
              onClick={editable && !reservedBy ? () => onEquip(trinket.id) : undefined}
              ariaLabel={
                reservationReason
                  ? `${trinket.title}. ${reservationReason}`
                  : `Equip ${trinket.title}${equippedBy ? ` from ${equippedBy}` : ""}`
              }
            >
              {reservedBy ? (
                <Lock aria-hidden="true" className="absolute bottom-3 left-3 z-10 h-6 w-6 text-amber-200" />
              ) : null}
            </TrinketTile>
          </div>
        );
      })}
    </PagedPickerGrid>
  );
}
