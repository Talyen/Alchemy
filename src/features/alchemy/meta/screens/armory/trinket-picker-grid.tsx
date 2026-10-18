import { useGameTranslation } from "@/components/use-game-translation";

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
  equippedTrinkets,
  editable,
  onEquip,
  onCombatLockedAttempt,
  page,
  totalPages,
  onPageChange,
  fillerCount,
  pageItems,
  noMatches,
  placeholderIndex,
  hiddenArtworkIds,
}: {
  reservedTrinkets: Record<string, CharacterId>;
  equippedTrinkets: EquippedTrinkets;
  editable: boolean;
  onEquip: (trinketId: string) => void;
  onCombatLockedAttempt: () => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  fillerCount: number;
  pageItems: TrinketEntry[];
  noMatches?: boolean;
  placeholderIndex?: number | null | undefined;
  hiddenArtworkIds?: ReadonlySet<string> | undefined;
}) {
  const i18n = useGameTranslation();
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
      noMatches={noMatches}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      fillerCount={fillerCount}
      pageItems={pageItems}
      placeholderIndex={placeholderIndex}
      testId="armory-trinket-picker"
      fillerTestId="armory-inventory-filler"
      swapKey="gear"
      renderItem={(trinket) => {
        const reservedBy = reservedTrinkets[trinket.id];
        const isArtHidden = hiddenArtworkIds?.has(trinket.id) ?? false;
        const reservationReason = i18n.read(() => reservedReasonFor(reservedBy ?? null));
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
                ariaLabel={i18n.displayText(
                  reservationReason
                    ? i18n.text("ui.trinket-picker-grid.d1", "{{value0}}. {{value1}}", {
                        value0: i18n.displayText(trinket.title),
                        value1: i18n.displayText(reservationReason),
                      })
                    : i18n.read(() => formatTrinketEquipAriaLabel(trinket.title, equippedCharacterId)),
                )}
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
