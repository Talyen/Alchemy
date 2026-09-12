import { beforeEach, describe, expect, it, vi } from "vitest";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { deriveGearCombatRestrictions } from "@/features/alchemy/shared/stores/gear-combat-restrictions";
import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import type { GearInstance } from "@/lib/gear";

const sword: GearInstance = { instanceId: "reserved-sword", definitionId: "longsword-basic", affixes: [] };
const spare: GearInstance = { instanceId: "spare-sword", definitionId: "longsword-basic", affixes: [] };

describe("combat equipment protection", () => {
  beforeEach(() => {
    resetAllTestStores();
    dispatchGearMutationWithRunHealthSync({
      mutate: (gear) => {
        gear.addInstance(sword, "knight");
        gear.addInstance(spare, "knight");
        gear.equip("knight", "main-hand", sword);
        gear.addTrinket("brass-censer");
        gear.equipTrinket("knight", "brass-censer");
        gear.addCurrencies({ "ascension-seal": 3 });
      },
    });
    dispatchRunSessionCommand((draft) => {
      draft.session.activity = { kind: "idle" };
      draft.battle.hasActiveBattle = true;
    });
  });

  it("rejects every route to changing a battle loadout without touching state or RNG", () => {
    const before = readGameplayState();
    const rng = vi.fn(() => 0.5);
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.equip("knight", "main-hand", spare) })).toBe(
      false,
    );
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.unequip("knight", "main-hand") })).toBe(
      false,
    );
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.equip("rogue", "main-hand", sword) })).toBe(
      false,
    );
    expect(
      dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.equipTrinket("rogue", "brass-censer") }),
    ).toBe(false);
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.unequipTrinket("knight") })).toBe(false);
    expect(
      dispatchGearMutationWithRunHealthSync({
        mutate: (gear) => gear.applyCurrency("ascension-seal", sword.instanceId, { rng }),
      }),
    ).toBe(false);
    expect(dispatchGearSalvageWithMaterialGrant((gear) => gear.salvage(sword.instanceId))).toBeNull();
    expect(rng).not.toHaveBeenCalled();
    expect(readGameplayState()).toBe(before);
  });

  it("allows unused shared gear and acquisitions without changing the battle equipment", () => {
    const manifest = readGameplayState().battle.battleState.gearEffects;
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.equip("rogue", "main-hand", spare) })).toBe(
      true,
    );
    dispatchGearMutationWithRunHealthSync({
      mutate: (gear) => gear.addInstance({ ...spare, instanceId: "reward" }, "knight"),
    });
    expect(readGameplayState().gear.loadouts.knight["main-hand"]).toBe(sword.instanceId);
    expect(readGameplayState().battle.battleState.gearEffects).toEqual(manifest);
  });

  it("keeps a pending lethal transition reserved until the battle lifecycle ends", () => {
    dispatchRunSessionCommand((draft) => {
      draft.battle.battleState.enemyHealth = 0;
      draft.battle.pendingBattleTransition = { kind: "continue-end-turn" };
    });
    expect(deriveGearCombatRestrictions(readGameplayState()).characters.knight).toEqual(["campaign"]);
    dispatchRunSessionCommand((draft) => {
      draft.battle.hasActiveBattle = false;
    });
    expect(deriveGearCombatRestrictions(readGameplayState()).characters).toEqual({});
  });
});
