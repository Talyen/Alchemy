import { setBattleActiveForTest, getBattleForTest } from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { deriveGearCombatRestrictions } from "@/features/alchemy/shared/stores/gear-combat-restrictions";
import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";
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
    dispatchGameplayCommand((draft) => {
      draft.session.activity = { kind: "idle" };
      setBattleActiveForTest(draft, true);

      return acceptCommand();
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
    const manifest = readBattle().battleState.gearEffects;
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.equip("rogue", "main-hand", spare) })).toBe(
      true,
    );
    dispatchGearMutationWithRunHealthSync({
      mutate: (gear) => gear.addInstance({ ...spare, instanceId: "reward" }, "knight"),
    });
    expect(readGameplayState().gear.loadouts.knight["main-hand"]).toBe(sword.instanceId);
    expect(readBattle().battleState.gearEffects).toEqual(manifest);
  });

  it("rolls back earlier Gear writes when a later operation returns false or null", () => {
    const before = readGameplayState();
    expect(
      dispatchGearMutationWithRunHealthSync({
        mutate: (gear) => {
          gear.addCurrencies({ voidstone: 1 });
          return gear.unequip("knight", "main-hand");
        },
      }),
    ).toBe(false);
    expect(readGameplayState()).toBe(before);

    expect(
      dispatchGearSalvageWithMaterialGrant((gear) => {
        gear.addCurrencies({ voidstone: 1 });
        return gear.salvage(sword.instanceId);
      }),
    ).toBeNull();
    expect(readGameplayState()).toBe(before);
  });

  it("keeps a pending lethal transition reserved until the battle lifecycle ends", () => {
    dispatchGameplayCommand((draft) => {
      getBattleForTest(draft).battleState.enemyHealth = 0;

      return acceptCommand();
    });
    expect(deriveGearCombatRestrictions(readGameplayState())).toEqual({
      characters: { knight: ["campaign"] },
      gear: { [sword.instanceId]: "knight" },
      trinkets: { "brass-censer": "knight" },
    });
    dispatchGameplayCommand((draft) => {
      setBattleActiveForTest(draft, false);

      return acceptCommand();
    });
    expect(deriveGearCombatRestrictions(readGameplayState())).toEqual({ characters: {}, gear: {}, trinkets: {} });
  });
});
