import {
  mutateGameplayForTest,
  setBattleActiveForTest,
  getBattleForTest,
  resetAllTestStores,
} from "../../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import { deriveGearCombatRestrictions } from "@/features/alchemy/shared/stores/session/gear-combat-restrictions";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/commands/gear-session-command";
import {
  equipGear,
  unequipGear,
  equipTrinket,
  unequipTrinket,
  applyCurrencyToGear,
  salvageGear,
} from "@/features/alchemy/shared/stores/commands/gear-commands";

import type { GearInstance } from "@/lib/gear";
import { defaultGameSession } from "@/app/application-session";

const sword: GearInstance = { instanceId: "reserved-sword", definitionId: "longsword-basic", affixes: [] };
const spare: GearInstance = { instanceId: "spare-sword", definitionId: "longsword-basic", affixes: [] };

describe("combat equipment protection", () => {
  beforeEach(() => {
    resetAllTestStores();
    dispatchGearMutationWithRunHealthSync(
      {
        mutate: (gear) => {
          gear.addInstance(sword, "knight");
          gear.addInstance(spare, "knight");
          gear.equip("knight", "main-hand", sword);
          gear.addTrinket("brass-censer");
          gear.equipTrinket("knight", "brass-censer");
          gear.addCurrencies({ "ascension-seal": 3 });
        },
      },
      defaultGameSession,
    );
    mutateGameplayForTest((draft) => {
      draft.session.activity = { kind: "idle" };
      setBattleActiveForTest(draft, true);
    });
  });

  it("rejects every route to changing a battle loadout without touching state or RNG", () => {
    const before = readGameplayState(defaultGameSession);
    const rng = vi.fn(() => 0.5);
    expect(equipGear("knight", "main-hand", spare, defaultGameSession)).toBe(false);
    expect(unequipGear("knight", "main-hand", defaultGameSession)).toBe(false);
    expect(equipGear("rogue", "main-hand", sword, defaultGameSession)).toBe(false);
    expect(equipTrinket("rogue", "brass-censer", defaultGameSession)).toBe(false);
    expect(unequipTrinket("knight", defaultGameSession)).toBe(false);
    expect(applyCurrencyToGear("ascension-seal", sword.instanceId, { rng }, defaultGameSession)).toBe(false);
    expect(salvageGear(sword.instanceId, defaultGameSession)).toBe(false);
    expect(rng).not.toHaveBeenCalled();
    expect(readGameplayState(defaultGameSession)).toBe(before);
  });

  it("allows unused shared gear and acquisitions without changing the battle equipment", () => {
    const manifest = readBattle(defaultGameSession).battleState.gearEffects;
    expect(equipGear("rogue", "main-hand", spare, defaultGameSession)).toBe(true);
    dispatchGearMutationWithRunHealthSync(
      {
        mutate: (gear) => gear.addInstance({ ...spare, instanceId: "reward" }, "knight"),
      },
      defaultGameSession,
    );
    expect(readGameplayState(defaultGameSession).gear.loadouts.knight["main-hand"]).toBe(sword.instanceId);
    expect(readBattle(defaultGameSession).battleState.gearEffects).toEqual(manifest);
  });

  it.each(["constructor", "__proto__"])("treats opaque %s item IDs as ordinary shared spares", (instanceId) => {
    const item = { ...spare, instanceId };
    dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.addInstance(item, "knight") }, defaultGameSession);
    expect(equipGear("rogue", "main-hand", item, defaultGameSession)).toBe(true);
    expect(readGameplayState(defaultGameSession).gear.loadouts.rogue["main-hand"]).toBe(instanceId);
  });

  it("rolls back earlier Gear writes when a later operation rejects", () => {
    const before = readGameplayState(defaultGameSession);
    expect(
      dispatchGearMutationWithRunHealthSync(
        {
          mutate: (gear) => {
            gear.addCurrencies({ voidstone: 1 });
            return gear.unequip("knight", "main-hand");
          },
        },
        defaultGameSession,
      ),
    ).toBe(false);
    expect(readGameplayState(defaultGameSession)).toBe(before);
  });

  it("keeps a pending lethal transition reserved until the battle lifecycle ends", () => {
    mutateGameplayForTest((draft) => {
      getBattleForTest(draft).battleState.enemyHealth = 0;
    });
    expect(deriveGearCombatRestrictions(readGameplayState(defaultGameSession))).toEqual({
      characters: { knight: ["campaign"] },
      gear: { [sword.instanceId]: "knight" },
      trinkets: { "brass-censer": "knight" },
    });
    mutateGameplayForTest((draft) => {
      setBattleActiveForTest(draft, false);
    });
    expect(deriveGearCombatRestrictions(readGameplayState(defaultGameSession))).toEqual({
      characters: {},
      gear: {},
      trinkets: {},
    });
  });
});
