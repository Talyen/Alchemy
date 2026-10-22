import type { GameSession } from "../session/game-session-types";
import { readGameplayState } from "../session/gameplay-state-reads";
import { initializeGear } from "../commands/gear-actions";
import { createDefaultGearSaveFields } from "../session/gear-state-defaults";
import type { GearSaveFields } from "../session/gear-store-types";
import type { GameplayPersistenceCodec } from "./persistence-codec";

export const gearPersistenceCodec: GameplayPersistenceCodec<GearSaveFields> = {
  createDefault: createDefaultGearSaveFields,
  encode: (gameSession: GameSession) => {
    const state = readGameplayState(gameSession).gear;
    return structuredClone({
      gearInventories: state.inventories,
      gearLoadouts: state.loadouts,
      ownedTrinketIds: state.ownedTrinketIds,
      equippedTrinkets: state.equippedTrinkets,
      craftingCurrencies: state.craftingCurrencies,
    });
  },
  hydrate: (fields, draft) => {
    initializeGear(
      draft.gear,
      fields.gearInventories,
      fields.gearLoadouts,
      fields.craftingCurrencies,
      fields.ownedTrinketIds,
      fields.equippedTrinkets,
    );
  },
};
