import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { createEmptyRewardState } from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { createRunRngState } from "@/lib/run-rng";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addRunMaterialsEarned,
  awardMysteryXP,
  beginDestinationClaim,
  beginRewardClaim,
  cancelDestinationClaim,
  clearRunMaterialsEarned,
  clearTransientSession,
  initializeActiveBattle,
  recordRunObtainedItem,
  releaseRewardClaim,
  setCompanionRewardCards,
  setPendingCharacterId,
  setRewardState,
  setRoomsEncountered,
  setScreen,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  clearPendingTransitionResumeRequired,
  setDisplayOverrides,
  setSyncedBattleState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { nextRunRandom, resetProgress } from "@/features/alchemy/shared/stores/write-port-run";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetAllTestStores();
});

describe("battle write-port", () => {
  it("initializeActiveBattle records the start state and activates combat", () => {
    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, { ...defaultBattleState(), turn: 6, playerHealth: 11 }),
    );
    const state = readBattle();
    expect(state.hasActiveBattle).toBe(true);
    expect(state.battleStartState?.turn).toBe(6);
    expect(state.battleStartState).toEqual(state.battleState);
    expect(state.displayOverrides).toEqual({});
    expect(state.pendingTransitionResumeRequired).toBe(false);
  });

  it("marks hydrated transitions as requiring resume until cleared", () => {
    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, { ...defaultBattleState(), turnPhase: "enemy" }, { kind: "continue-end-turn" }),
    );
    let state = readBattle();
    expect(state.pendingTransitionResumeRequired).toBe(true);
    expect(state.pendingBattleTransition).toEqual({ kind: "continue-end-turn" });

    dispatchRunSessionCommand((draft) => clearPendingTransitionResumeRequired(draft));
    state = readBattle();
    expect(state.pendingTransitionResumeRequired).toBe(false);
    expect(state.pendingBattleTransition).toEqual({ kind: "continue-end-turn" });
  });

  it("initializing with null clears every combat field", () => {
    dispatchRunSessionCommand((draft) => {
      initializeActiveBattle(draft, { ...defaultBattleState(), turn: 2 }, { kind: "continue-end-turn" });
      setDisplayOverrides(draft, { playerHealth: 1 });
      initializeActiveBattle(draft, null);
    });
    const state = readBattle();
    expect(state.hasActiveBattle).toBe(false);
    expect(state.battleStartState).toBeNull();
    expect(state.pendingBattleTransition).toBeNull();
    expect(state.pendingTransitionResumeRequired).toBe(false);
    expect(state.displayOverrides).toEqual({});
  });

  it("setSyncedBattleState replaces state and drops stale display overrides", () => {
    dispatchRunSessionCommand((draft) => {
      setDisplayOverrides(draft, { playerHealth: 99 });
      setSyncedBattleState(draft, { ...defaultBattleState(), playerHealth: 7 });
    });
    const state = readBattle();
    expect(state.battleState.playerHealth).toBe(7);
    expect(state.hasActiveBattle).toBe(false);
    expect(state.displayOverrides).toEqual({});
  });
});

describe("navigation write-port", () => {
  it("setScreen accepts direct values and updater functions", () => {
    dispatchRunSessionCommand((draft) => setScreen(draft, ROUTE_SCREENS.BATTLE));
    expect(readActiveRunScreen()).toBe("battle");
    dispatchRunSessionCommand((draft) =>
      setScreen(draft, (prev) => (prev === "battle" ? ROUTE_SCREENS.REWARDS : prev)),
    );
    expect(readActiveRunScreen()).toBe("rewards");
  });

  it("resetNavigation returns to the menu from any screen", () => {
    dispatchRunSessionCommand((draft) => setScreen(draft, ROUTE_SCREENS.SHOP));
    dispatchRunSessionCommand((draft) => setScreen(draft, "menu"));
    expect(readActiveRunScreen()).toBe("menu");
  });
});

describe("session write-port", () => {
  const rewardCard: BattleCard = {
    id: "fireball",
    title: "Fireball",
    descriptionLines: [""],
    art: "",
    cost: 3,
    effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
  };

  it("gates beginRewardClaim on pending rewards and one claim at a time", () => {
    expect(dispatchRunSessionCommand((draft) => beginRewardClaim(draft))).toBe(false);
    expect(readRunSession().rewardClaimInFlight).toBe(false);

    dispatchRunSessionCommand((draft) => setCompanionRewardCards(draft, [rewardCard]));
    expect(dispatchRunSessionCommand((draft) => beginRewardClaim(draft))).toBe(true);
    expect(readRunSession().rewardClaimInFlight).toBe(true);
    expect(dispatchRunSessionCommand((draft) => beginRewardClaim(draft))).toBe(false);

    dispatchRunSessionCommand((draft) => releaseRewardClaim(draft));
    expect(readRunSession().rewardClaimInFlight).toBe(false);
  });

  it("validates destination claims against offered destinations", () => {
    expect(dispatchRunSessionCommand((draft) => beginDestinationClaim(draft, DESTINATIONS.MYSTERY))).toBe(false);
    expect(readRunSession().pendingDestinationClaim).toBeNull();

    dispatchRunSessionCommand((draft) =>
      setRewardState(draft, { ...createEmptyRewardState([DESTINATIONS.MYSTERY]), gold: 30 }),
    );
    expect(dispatchRunSessionCommand((draft) => beginDestinationClaim(draft, DESTINATIONS.MYSTERY))).toBe(true);
    expect(readRunSession().pendingDestinationClaim).toBe(DESTINATIONS.MYSTERY);
    expect(dispatchRunSessionCommand((draft) => beginDestinationClaim(draft, DESTINATIONS.CAMPFIRE))).toBe(false);

    dispatchRunSessionCommand((draft) => cancelDestinationClaim(draft));
    expect(readRunSession().pendingDestinationClaim).toBeNull();
  });

  it("clearTransientSession restores initial transient fields", () => {
    dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      setPendingCharacterId(draft, "rogue");
      clearTransientSession(draft);
    });
    const cleared = readRunSession();
    expect(cleared.hasActiveRun).toBe(false);
    expect(cleared.rewardClaimInFlight).toBe(false);
    expect(cleared.pendingDestinationClaim).toBeNull();
    expect(cleared.pendingCharacterId).toBeNull();
  });
});

describe("progress write-port", () => {
  it("nextRunRandom advances per-stream counters independently within [0, 1)", () => {
    setRunProgress({ rng: createRunRngState(() => 0.5) });
    const first = dispatchRunSessionCommand((draft) => nextRunRandom(draft, "rewards"));
    const second = dispatchRunSessionCommand((draft) => nextRunRandom(draft, "rewards"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(second).not.toBe(first);
    expect(readActiveRun().rng.counters.rewards).toBe(2);
    expect(readActiveRun().rng.counters.world).toBe(0);
  });

  it("addRunMaterialsEarned aggregates across grants and clear empties the tally", () => {
    dispatchRunSessionCommand((draft) => {
      addRunMaterialsEarned(draft, { wood: 2, iron: 0, herbs: 1, food: 0, crystal: 0 });
      addRunMaterialsEarned(draft, { wood: 3, iron: 1, herbs: 0, food: 0, crystal: 2 });
    });
    expect(readActiveRun().runMaterialsEarned).toEqual({
      wood: 5,
      iron: 1,
      herbs: 1,
      food: 0,
      crystal: 2,
    });
    dispatchRunSessionCommand((draft) => clearRunMaterialsEarned(draft));
    expect(readActiveRun().runMaterialsEarned).toEqual(emptyInventory());
  });

  it("recordRunObtainedItem appends gear and trinket grants in order", () => {
    const instance = { instanceId: "obtained-armor", definitionId: "leather-armor-basic" as const, affixes: [] };
    dispatchRunSessionCommand((draft) => {
      recordRunObtainedItem(draft, { kind: "gear", instance });
      recordRunObtainedItem(draft, { kind: "trinket", trinketId: "bone-charm" });
    });
    expect(readActiveRun().runObtainedItems).toEqual([
      { kind: "gear", instance },
      { kind: "trinket", trinketId: "bone-charm" },
    ]);
  });

  it("resetProgress preserves character while clearing run-scoped tallies", () => {
    setRunProgress({ characterId: "rogue" });
    dispatchRunSessionCommand((draft) => {
      awardMysteryXP(draft, "burn", 50);
      setRoomsEncountered(draft, 7);
      resetProgress(draft);
    });
    const reset = readActiveRun();
    expect(reset.characterId).toBe("rogue");
    expect(reset.runTalentXP).toEqual({});
    expect(reset.roomsEncountered).toBe(0);
    expect(reset.initialized).toBe(true);
  });
});
