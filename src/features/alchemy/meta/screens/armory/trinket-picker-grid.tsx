import { useState } from "react";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { EquippedTrinkets } from "@/lib/gear";
import { cn } from "@/lib/utils";
import {
  collectionGridGapXClass,
  collectionGridTileWidthClass,
  gearArtAspectClass,
} from "@/features/alchemy/shared/config";
import { TrinketTile } from "@/features/alchemy/shared/ui/collection-art-tiles";
import { FadeSlot } from "@/features/alchemy/shared/ui/fade-slot";
import { PaginationControls } from "@/features/alchemy/shared/ui/shared-ui";

const PAGE_SIZE = 6;
const FILLER_INDICES = Array.from({ length: PAGE_SIZE }, (_, i) => i);

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
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(trinkets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = trinkets.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const fillerCount = PAGE_SIZE - pageItems.length;

  return (
    <section data-testid="armory-trinket-picker" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FadeSlot swapKey={`${characterId}-${safePage}`} className="relative mt-2 w-full overflow-visible">
        {trinkets.length === 0 ? (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center text-xl text-muted-foreground">
            Empty
          </p>
        ) : null}
        <div className={cn("grid w-full grid-cols-3 grid-rows-2", collectionGridGapXClass, "gap-y-6")}>
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
          {FILLER_INDICES.slice(0, fillerCount).map((index) => (
            <div
              key={`armory-trinket-filler-${index}`}
              className={cn(collectionGridTileWidthClass, gearArtAspectClass)}
            />
          ))}
        </div>
      </FadeSlot>
      <div className="mt-auto flex justify-center">
        <PaginationControls
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          size="default"
          reserveSpace
        />
      </div>
    </section>
  );
}
