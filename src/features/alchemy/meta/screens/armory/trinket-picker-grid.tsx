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
}: {
  reservedTrinkets: Record<string, CharacterId>;
  characterId: CharacterId;
  trinkets: TrinketEntry[];
  equippedTrinkets: EquippedTrinkets;
  editable: boolean;
  onEquip: (trinketId: string) => void;
  onCombatLockedAttempt: () => void;
}) {
  return (
    <ArmoryPagedGrid
      items={trinkets}
      selectedId={equippedTrinkets[characterId]}
      context={`trinket:${characterId}`}
      testId="armory-trinket-picker"
      swapKey={characterId}
      renderItem={(trinket) => {
        const reservedBy = reservedTrinkets[trinket.id];
        const reservationReason = reservedReasonFor(reservedBy ?? null);
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
              chip={reservationReason ?? undefined}
              interactiveChrome={editable && !reservedBy}
              onClick={reservedBy ? undefined : editable ? () => onEquip(trinket.id) : () => onCombatLockedAttempt()}
              ariaLabel={
                reservationReason
                  ? `${trinket.title}. ${reservationReason}`
                  : formatTrinketEquipAriaLabel(trinket.title, equippedBy)
              }
            >
              {reservedBy ? <ReservedLock /> : null}
            </TrinketTile>
          </div>
        );
      }}
    />
  );
}
