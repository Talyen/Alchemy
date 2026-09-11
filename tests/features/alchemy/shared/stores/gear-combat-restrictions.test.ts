import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { CharacterId } from "@/lib/game-data";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { deriveGearCombatRestrictions } from "@/features/alchemy/shared/stores/gear-combat-restrictions";
import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  parkAndDeactivateForegroundRunInDraft,
  hydrateModeRunInDraft,
  clearModeSlotInDraft,
} from "@/features/alchemy/shared/stores/run-park-restore";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { makeActiveRunData } from "./active-run-data-fixture";
import type { GearInstance } from "@/lib/gear";

const sword: GearInstance = { instanceId: "reserved-sword", definitionId: "longsword-basic", affixes: [] };
const spare: GearInstance = { instanceId: "spare-sword", definitionId: "longsword-basic", affixes: [] };

function suspendedBattle(mode: ContentSystemId, characterId: CharacterId = "knight") {
  return makeActiveRunData({
    contentSystemType: mode,
    characterId,
    activeCombat: {
      battleState: defaultBattleState(),
      pendingBattleTransition: null,
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
    },
  });
}

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

  it("reserves equipment across parking, restoration, and abandoning a suspended run", () => {
    dispatchRunSessionCommand(parkAndDeactivateForegroundRunInDraft);
    expect(deriveGearCombatRestrictions(readGameplayState()).characters.knight).toEqual(["campaign"]);
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.equip("rogue", "main-hand", sword) })).toBe(
      false,
    );
    dispatchRunSessionCommand((draft) => hydrateModeRunInDraft(draft, "campaign"));
    expect(deriveGearCombatRestrictions(readGameplayState()).gear[sword.instanceId]).toBe("knight");
    dispatchRunSessionCommand(parkAndDeactivateForegroundRunInDraft);
    dispatchRunSessionCommand((draft) => clearModeSlotInDraft(draft, "campaign"));
    expect(deriveGearCombatRestrictions(readGameplayState()).characters).toEqual({});
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.equip("rogue", "main-hand", sword) })).toBe(
      true,
    );
  });

  it("keeps a hero reserved until every battle finishes, ignoring a stale foreground snapshot", () => {
    dispatchRunSessionCommand((draft) => {
      draft.run.parkedRuns.campaign = suspendedBattle("campaign");
      draft.run.parkedRuns.labyrinth = suspendedBattle("labyrinth");
      draft.battle.hasActiveBattle = false;
    });
    expect(deriveGearCombatRestrictions(readGameplayState()).characters.knight).toEqual(["labyrinth"]);
    dispatchRunSessionCommand((draft) => clearModeSlotInDraft(draft, "labyrinth"));
    expect(deriveGearCombatRestrictions(readGameplayState()).characters).toEqual({});
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

  it.each(["victory", "defeat"])("does not reserve a finished parked battle after %s", (outcome) => {
    dispatchRunSessionCommand((draft) => {
      draft.battle.hasActiveBattle = false;
      const run = suspendedBattle("labyrinth", "rogue");
      if (outcome === "victory") run.activeCombat!.battleState.enemyHealth = 0;
      else {
        run.activeCombat!.battleState.playerHealth = 0;
        run.activeCombat!.battleState.deathsDoorActive = false;
      }
      draft.run.parkedRuns.labyrinth = run;
    });
    expect(deriveGearCombatRestrictions(readGameplayState()).characters).toEqual({});
  });
});
