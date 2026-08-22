import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { createEmptyRewardState } from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { createRunRngState } from "@/lib/run-rng";
import {
  applyGameplayStateUpdate,
  getBattleStoreView,
  getNavigationStoreView,
  getRunDomainStore,
  getRunTransientStore,
  resetAllTestStores,
} from "../../../../helpers/gameplay-store-test";

beforeEach(() => {
  resetAllTestStores();
});

describe("battle slice", () => {
  it("initializeActiveBattle records the start state and activates combat", () => {
    getBattleStoreView().initializeActiveBattle({ ...defaultBattleState(), turn: 6, playerHealth: 11 });
    const state = getBattleStoreView();
    expect(state.hasActiveBattle).toBe(true);
    expect(state.battleStartState?.turn).toBe(6);
    expect(state.battleStartState).toEqual(state.battleState);
    expect(state.displayOverrides).toEqual({});
    expect(state.pendingTransitionResumeRequired).toBe(false);
  });

  it("marks hydrated transitions as requiring resume until cleared", () => {
    const battle = getBattleStoreView();
    battle.initializeActiveBattle({ ...defaultBattleState(), turnPhase: "enemy" }, { kind: "continue-end-turn" });
    let state = getBattleStoreView();
    expect(state.pendingTransitionResumeRequired).toBe(true);
    expect(state.pendingBattleTransition).toEqual({ kind: "continue-end-turn" });

    battle.clearPendingTransitionResumeRequired();
    state = getBattleStoreView();
    expect(state.pendingTransitionResumeRequired).toBe(false);
    expect(state.pendingBattleTransition).toEqual({ kind: "continue-end-turn" });
  });

  it("initializing with null clears every combat field", () => {
    const battle = getBattleStoreView();
    battle.initializeActiveBattle({ ...defaultBattleState(), turn: 2 }, { kind: "continue-end-turn" });
    battle.setDisplayOverrides({ playerHealth: 1 });
    battle.initializeActiveBattle(null);
    const state = getBattleStoreView();
    expect(state.hasActiveBattle).toBe(false);
    expect(state.battleStartState).toBeNull();
    expect(state.pendingBattleTransition).toBeNull();
    expect(state.pendingTransitionResumeRequired).toBe(false);
    expect(state.displayOverrides).toEqual({});
  });

  it("setSyncedBattleState replaces state and drops stale display overrides", () => {
    const battle = getBattleStoreView();
    battle.setDisplayOverrides({ playerHealth: 99 });
    battle.setSyncedBattleState({ ...defaultBattleState(), playerHealth: 7 });
    const state = getBattleStoreView();
    expect(state.battleState.playerHealth).toBe(7);
    expect(state.hasActiveBattle).toBe(false);
    expect(state.displayOverrides).toEqual({});
  });
});

describe("navigation slice", () => {
  it("setScreen accepts direct values and updater functions", () => {
    getRunDomainStore().setScreen(ROUTE_SCREENS.BATTLE);
    expect(getNavigationStoreView().screen).toBe("battle");
    getRunDomainStore().setScreen((prev) => (prev === "battle" ? ROUTE_SCREENS.REWARDS : prev));
    expect(getNavigationStoreView().screen).toBe("rewards");
  });

  it("resetNavigation returns to the menu from any screen", () => {
    getRunDomainStore().setScreen(ROUTE_SCREENS.SHOP);
    getRunDomainStore().resetNavigation();
    expect(getNavigationStoreView().screen).toBe("menu");
  });
});

describe("session slice", () => {
  const rewardCard: BattleCard = {
    id: "fireball",
    title: "Fireball",
    descriptionLines: [""],
    art: "",
    cost: 3,
    effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
  };

  it("gates beginRewardClaim on pending rewards and one claim at a time", () => {
    const session = getRunTransientStore();
    expect(session.beginRewardClaim()).toBe(false);
    expect(getRunTransientStore().rewardClaimInFlight).toBe(false);

    session.setCompanionRewardCards([rewardCard]);
    expect(session.beginRewardClaim()).toBe(true);
    expect(getRunTransientStore().rewardClaimInFlight).toBe(true);
    expect(session.beginRewardClaim()).toBe(false);

    session.releaseRewardClaim();
    expect(getRunTransientStore().rewardClaimInFlight).toBe(false);
  });

  it("validates destination claims against offered destinations", () => {
    const session = getRunTransientStore();
    expect(session.beginDestinationClaim(DESTINATIONS.MYSTERY)).toBe(false);
    expect(getRunTransientStore().pendingDestinationClaim).toBeNull();

    session.setRewardState({ ...createEmptyRewardState([DESTINATIONS.MYSTERY]), gold: 30 });
    expect(session.beginDestinationClaim(DESTINATIONS.MYSTERY)).toBe(true);
    expect(getRunTransientStore().pendingDestinationClaim).toBe(DESTINATIONS.MYSTERY);
    expect(session.beginDestinationClaim(DESTINATIONS.CAMPFIRE)).toBe(false);

    session.cancelDestinationClaim();
    expect(getRunTransientStore().pendingDestinationClaim).toBeNull();
  });

  it("applyDestinationChoices keeps only valid labels and resets reward fields", () => {
    getRunTransientStore().setRewardState({ ...createEmptyRewardState(), gold: 40 });
    getRunTransientStore().applyDestinationChoices(["bogus", DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY]);
    const reward = getRunTransientStore().rewardState;
    expect(reward.destinations).toEqual([DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY]);
    expect(reward.gold).toBe(0);
  });

  it("clearTransientSession restores initial transient fields", () => {
    const session = getRunTransientStore();
    session.setHasActiveRun(true);
    session.setPendingCharacterId("rogue");
    session.clearTransientSession();
    const cleared = getRunTransientStore();
    expect(cleared.hasActiveRun).toBe(false);
    expect(cleared.rewardClaimInFlight).toBe(false);
    expect(cleared.pendingDestinationClaim).toBeNull();
    expect(cleared.pendingCharacterId).toBeNull();
  });
});

describe("progress slice", () => {
  it("nextRunRandom advances per-stream counters independently within [0, 1)", () => {
    applyGameplayStateUpdate((state) => {
      state.run.activeRun.rng = createRunRngState(() => 0.5);
    });
    const run = getRunDomainStore();
    const first = run.nextRunRandom("rewards");
    const second = run.nextRunRandom("rewards");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(second).not.toBe(first);
    expect(getRunDomainStore().activeRun.rng.counters.rewards).toBe(2);
    expect(getRunDomainStore().activeRun.rng.counters.world).toBe(0);
  });

  it("addRunMaterialsEarned aggregates across grants and clear empties the tally", () => {
    const run = getRunDomainStore();
    run.addRunMaterialsEarned({ wood: 2, iron: 0, herbs: 1, food: 0, crystal: 0 });
    run.addRunMaterialsEarned({ wood: 3, iron: 1, herbs: 0, food: 0, crystal: 2 });
    expect(getRunDomainStore().activeRun.runMaterialsEarned).toEqual({
      wood: 5,
      iron: 1,
      herbs: 1,
      food: 0,
      crystal: 2,
    });
    run.clearRunMaterialsEarned();
    expect(getRunDomainStore().activeRun.runMaterialsEarned).toEqual(emptyInventory());
  });

  it("resetProgress preserves character while clearing run-scoped tallies", () => {
    const run = getRunDomainStore();
    run.setCharacter("rogue");
    run.awardMysteryXP("burn", 50);
    run.setRoomsEncountered(7);
    run.resetProgress();
    const reset = getRunDomainStore();
    expect(reset.activeRun.characterId).toBe("rogue");
    expect(reset.activeRun.runTalentXP).toEqual({});
    expect(reset.activeRun.roomsEncountered).toBe(0);
    expect(reset.initialized).toBe(true);
  });
});
