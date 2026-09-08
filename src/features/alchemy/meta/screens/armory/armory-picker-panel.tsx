import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sectionTitleClass } from "@/features/alchemy/shared/config";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { ArmorySlot, EquippedTrinkets, GearInstance, GearLoadout, GearLoadouts } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { ItemPickerGrid } from "./item-picker-grid";
import { SLOT_LABELS } from "./parts/slot-labels";
import { TrinketPickerGrid } from "./trinket-picker-grid";

import type { GearCombatRestrictions } from "../../../shared/stores/gear-store";
import type { ArmoryItemActions, ArmoryTargeting } from "./armory-screen-types";

interface ArmoryPickerPanelProps {
  combatRestrictions: GearCombatRestrictions;
  selectedSlot: ArmorySlot;
  characterId: CharacterId;
  pickerItems: GearInstance[];
  ownedTrinkets: TrinketEntry[];
  equippedTrinkets: EquippedTrinkets;
  loadout: GearLoadout;
  loadouts: GearLoadouts;
  inventory: GearInstance[];
  targeting: ArmoryTargeting;
  actions: ArmoryItemActions;
  onSpawnDevGear: ((characterId: CharacterId) => void) | undefined;
}

export function ArmoryPickerPanel({
  combatRestrictions,
  selectedSlot,
  characterId,
  pickerItems,
  ownedTrinkets,
  equippedTrinkets,
  loadout,
  loadouts,
  inventory,
  targeting,
  actions,
  onSpawnDevGear,
}: ArmoryPickerPanelProps) {
  const { editable, salvageMode, activeCurrencyId, craftingResult } = targeting;
  return (
    <section
      data-testid="armory-right-panel"
      className="alchemy-shell relative flex min-h-0 min-w-0 flex-col rounded-shell-dialog border border-border/80 p-4"
    >
      <div className="relative flex min-h-10 w-full items-center justify-center">
        <h2 className={cn("text-center font-sans", sectionTitleClass)}>{SLOT_LABELS[selectedSlot]}</h2>
        {onSpawnDevGear && editable && selectedSlot !== "trinket" ? (
          <div className="absolute right-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Spawn random gear"
              onClick={() => onSpawnDevGear(characterId)}
            >
              <Dices className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
      {selectedSlot === "trinket" ? (
        <TrinketPickerGrid
          reservedTrinkets={combatRestrictions.trinkets}
          characterId={characterId}
          trinkets={ownedTrinkets}
          equippedTrinkets={equippedTrinkets}
          editable={editable}
          onEquip={actions.onEquipTrinket}
        />
      ) : (
        <ItemPickerGrid
          reservedGear={combatRestrictions.gear}
          slot={selectedSlot}
          characterId={characterId}
          items={pickerItems}
          loadout={loadout}
          loadouts={loadouts}
          inventory={inventory}
          editable={editable}
          salvageMode={salvageMode}
          activeCurrencyId={activeCurrencyId}
          onEquip={actions.onEquipGear}
          onSetProtected={actions.onSetProtected}
          craftingResult={craftingResult}
          onSalvage={actions.onSalvage}
          onApplyCurrency={actions.onApplyCurrency}
        />
      )}
    </section>
  );
}
