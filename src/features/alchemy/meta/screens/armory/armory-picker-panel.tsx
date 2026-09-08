import type { CraftingResult } from "./crafting-result";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sectionTitleClass } from "@/features/alchemy/shared/config";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type {
  ArmorySlot,
  CraftingCurrencyId,
  EquippedTrinkets,
  GearInstance,
  GearLoadout,
  GearLoadouts,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { ItemPickerGrid } from "./item-picker-grid";
import { SLOT_LABELS } from "./parts/slot-labels";
import { TrinketPickerGrid } from "./trinket-picker-grid";

import type { GearCombatRestrictions } from "../../../shared/stores/gear-store";

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
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  onSpawnDevGear: ((characterId: CharacterId) => void) | undefined;
  onEquipGear: (instance: GearInstance) => void;
  onEquipTrinket: (trinketId: string) => void;
  onSetProtected: (instanceId: string, protectedItem: boolean) => boolean;
  craftingResult: CraftingResult | null;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
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
  editable,
  salvageMode,
  activeCurrencyId,
  onSpawnDevGear,
  onEquipGear,
  onEquipTrinket,
  onSetProtected,
  craftingResult,
  onSalvage,
  onApplyCurrency,
}: ArmoryPickerPanelProps) {
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
          onEquip={onEquipTrinket}
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
          onEquip={onEquipGear}
          onSetProtected={onSetProtected}
          craftingResult={craftingResult}
          onSalvage={onSalvage}
          onApplyCurrency={onApplyCurrency}
        />
      )}
    </section>
  );
}
