import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { EquippedTrinkets } from "@/lib/gear";
import { TrinketTile } from "@/features/alchemy/shared/ui/collection-art-tiles";
import { collectionGridTileWidthClass } from "@/features/alchemy/shared/config";
import { ArmoryPagedGrid } from "./paged-picker-grid";
import { formatTrinketEquipAriaLabel, reservedReasonFor } from "./armory-item-state";
import { ReservedLock } from "./parts/armory-item-chrome";

export function TrinketPickerGrid({
  reservedTrinkets,
  characterId,
  trinkets,
  equippedTrinkets,
  editable,
  onEquip,
  onCombatLockedAttempt,
  page,
  totalPages,
  onPageChange,
  fillerCount,
  pageItems,
  placeholderIndex,
  hiddenArtworkIds,
}: {
  reservedTrinkets: Record<string, CharacterId>;
  characterId: CharacterId;
  trinkets: TrinketEntry[];
  equippedTrinkets: EquippedTrinkets;
  editable: boolean;
  onEquip: (trinketId: string) => void;
  onCombatLockedAttempt: () => void;
  page?: number | undefined;
  totalPages?: number | undefined;
  onPageChange?: ((page: number) => void) | undefined;
  fillerCount?: number | undefined;
  pageItems?: TrinketEntry[] | undefined;
  placeholderIndex?: number | null | undefined;
  hiddenArtworkIds?: ReadonlySet<string> | undefined;
}) {
  const reducedMotion = useReducedMotion();
  const equippedBy = useMemo(() => {
    const byTrinket = new Map<string, CharacterId>();
    for (const [charId, trinketId] of Object.entries(equippedTrinkets) as Array<[CharacterId, string | null]>) {
      if (trinketId) byTrinket.set(trinketId, charId);
    }
    return byTrinket;
  }, [equippedTrinkets]);

  return (
    <ArmoryPagedGrid
      items={trinkets}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      fillerCount={fillerCount}
      pageItems={pageItems}
      placeholderIndex={placeholderIndex}
      selectedId={equippedTrinkets[characterId]}
      context={`trinket:${characterId}`}
      testId="armory-trinket-picker"
      swapKey={characterId}
      renderItem={(trinket) => {
        const reservedBy = reservedTrinkets[trinket.id];
        const isArtHidden = hiddenArtworkIds?.has(trinket.id) ?? false;
        const reservationReason = reservedReasonFor(reservedBy ?? null);
        const equippedCharacterId = equippedBy.get(trinket.id);
        return (
          <motion.div
            key={trinket.id}
            layout={reducedMotion ? false : "position"}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <div data-testid="armory-trinket-item" data-trinket-id={trinket.id} className="relative">
              <TrinketTile
                trinket={trinket}
                interactionKey="armory-trinket"
                as="button"
                className={collectionGridTileWidthClass}
                imageClassName={isArtHidden ? "opacity-0" : undefined}
                ariaDisabled={!editable || Boolean(reservedBy)}
                chip={reservationReason ?? undefined}
                interactiveChrome={editable && !reservedBy}
                onClick={reservedBy ? undefined : editable ? () => onEquip(trinket.id) : () => onCombatLockedAttempt()}
                ariaLabel={
                  reservationReason
                    ? `${trinket.title}. ${reservationReason}`
                    : formatTrinketEquipAriaLabel(trinket.title, equippedCharacterId)
                }
              >
                {reservedBy ? <ReservedLock /> : null}
              </TrinketTile>
            </div>
          </motion.div>
        );
      }}
    />
  );
}
