import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createEmptyRewardState, type ActiveRunData } from "@/lib/active-run-session";
import { restoreRun, teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { getCurrentRunPhase } from "../../../../helpers/run-session-assertions";
import { getRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { cardLibrary, getStartingDeck } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { ANCIENT_ALTAR_MYSTERY_VISIT } from "./active-run-data-fixture";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  beginRewardClaim as mutateBeginRewardClaim,
  initializeActiveBattle as mutateInitializeActiveBattle,
  releaseRewardClaim as mutateReleaseRewardClaim,
  setCompanionRewardCards as mutateCompanionRewardCards,
  setHasActiveBattle as mutateHasActiveBattle,
  setHasActiveRun as mutateHasActiveRun,
  setRewardState as mutateRewardState,
  setScreen as mutateSetScreen,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setSyncedBattleState as mutateSyncedBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetProgress as mutateResetProgress } from "@/features/alchemy/shared/stores/write-port-run";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress } from "../../../../helpers/run-domain-store-test";

const resetProgress = createRunSessionCommand(mutateResetProgress);
const setSyncedBattleState = createRunSessionCommand(mutateSyncedBattleState);
const setHasActiveRun = createRunSessionCommand(mutateHasActiveRun);
const setHasActiveBattle = createRunSessionCommand(mutateHasActiveBattle);
const setRewardState = createRunSessionCommand(mutateRewardState);
const beginRewardClaim = createRunSessionCommand(mutateBeginRewardClaim);
const setCompanionRewardCards = createRunSessionCommand(mutateCompanionRewardCards);
const releaseRewardClaim = createRunSessionCommand(mutateReleaseRewardClaim);
const initializeActiveBattle = createRunSessionCommand(mutateInitializeActiveBattle);
const setScreen = createRunSessionCommand(mutateSetScreen);

beforeEach(() => {
  resetRunDomainStore();
});

describe("session facade API", () => {
  beforeEach(() => {
    teardownRun();
    resetProgress();
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, gold: 40, initialized: true });
    setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    setHasActiveRun(true);
  });

  it("getRunSession aggregates run, battle, and session fields for orchestration", () => {
    const session = getRunSession(ROUTE_SCREENS.MENU);
    expect(session.run.runPlayerHealth).toBe(18);
    expect(session.run.gold).toBe(40);
    expect(session.battle.battleState.playerHealth).toBe(10);
    expect(session.session.hasActiveRun).toBe(true);
    expect(session.phase).toBe("meta");
  });

  it("reads gold from the shared purse", () => {
    expect(getRunSession(ROUTE_SCREENS.MENU).run.gold).toBe(40);
  });

  it("getCurrentRunPhase reflects battle screen and hasActiveBattle", () => {
    setHasActiveBattle(true);
    expect(getCurrentRunPhase(ROUTE_SCREENS.BATTLE)).toBe("battle");
    setHasActiveBattle(false);
    expect(getCurrentRunPhase(ROUTE_SCREENS.BATTLE)).toBe("runLoop");
  });

  it("snapshotRun matches explicit snapshot fields", () => {
    setRunProgress({
      characterId: "knight",
      runDeck: [],
      gold: 12,
      runPlayerHealth: 18,
      runMaxHealth: 24,
      contentSystemType: "campaign",
    });
    setRewardState((prev) => ({ ...prev, destinations: ["Campfire", "Card Shop"] }));
    const snapshot = snapshotRun(ROUTE_SCREENS.DESTINATION);
    expect(snapshot).toMatchObject({
      characterId: "knight",
      runDeck: [],
      runPlayerHealth: 18,
      runMaxHealth: 24,
      contentSystemType: "campaign",
      currentScreen: ROUTE_SCREENS.DESTINATION,
      interruptedFlow: {
        kind: "destination",
        destinations: ["Campfire", "Card Shop"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    });
  });

  it("snapshots pending rewards on the rewards screen whenever choices are present", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    setRewardState({
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: [instance],
      gold: 5,
    });
    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({
          rewardType: "gear",
          gearChoices: [instance],
          gold: 5,
        }),
      }),
    );
  });

  it("omits primary reward choices while a claim is in flight but keeps destinations", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    setRewardState({
      ...createEmptyRewardState(["Campfire"]),
      rewardType: "gear",
      choices: [instance],
      gold: 5,
    });
    beginRewardClaim();
    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow).toEqual({
      kind: "destination",
      destinations: ["Campfire"],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    });
    expect(snap.currentScreen).toBe("destination");
  });

  it("encodes destination interruptedFlow for hollow boss mid-claim without destinations", () => {
    setRewardState({
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: [],
      lastVictoryEnemyType: "boss",
    });

    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.currentScreen).toBe("rewards");
    expect(snap.interruptedFlow).toEqual({
      kind: "destination",
      destinations: [],
      selectedBossId: null,
      lastVictoryEnemyType: "boss",
      lastVictoryContentSystem: null,
    });

    restoreRun(snap, {}, {});
    expect(readActiveRunScreen()).toBe("destination");
    expect(readRunSession().rewardState.choices).toEqual([]);
  });

  it("marks enemy-phase combat without a transition for boot recovery", () => {
    const enemyPhase = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };
    initializeActiveBattle(enemyPhase, null);
    setScreen(ROUTE_SCREENS.BATTLE);
    const snap = snapshotRun(ROUTE_SCREENS.BATTLE);
    expect(snap.activeCombat?.battleState.turnPhase).toBe("enemy");
    expect(snap.activeCombat?.pendingBattleTransition).toBeNull();

    restoreRun(snap, {}, {});
    expect(readBattle().pendingBattleTransition).toEqual({ kind: "legacy-enemy-turn" });
    expect(readBattle().battleState.turnPhase).toBe("enemy");
  });

  it("persists companion handoff during mid-claim and restores both offers", () => {
    const primary = cardLibrary.find((card) => card.id === "slash")!;
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"))!;
    setRewardState({
      ...createEmptyRewardState(["Card Shop"]),
      rewardType: "card",
      choices: [primary],
    });
    setCompanionRewardCards([companion]);
    beginRewardClaim();

    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow.kind).toBe("companion-reward");
    if (snap.interruptedFlow.kind === "companion-reward") {
      expect(snap.interruptedFlow.pending.rewardType).toBe("card");
      if (snap.interruptedFlow.pending.rewardType === "card") {
        expect(snap.interruptedFlow.pending.choiceIds).toEqual([primary.id]);
      }
      expect(snap.interruptedFlow.pending.companionChoiceIds).toEqual([companion.id]);
    }
    expect(snap.currentScreen).toBe("rewards");

    setRewardState(createEmptyRewardState());
    setCompanionRewardCards(null);
    releaseRewardClaim();
    restoreRun(snap, {}, {});

    const restored = readRunSession().rewardState;
    expect(restored.rewardType).toBe("card");
    if (restored.rewardType === "card") {
      expect(restored.choices.map((choice) => choice.id)).toEqual([primary.id]);
    }
    expect(readRunSession().companionRewardCards?.map((choice) => choice.id)).toEqual([companion.id]);
    expect(readActiveRunScreen()).toBe("rewards");
  });

  it("avoids soft-locking hollow boss rewards on resume", () => {
    setRewardState({
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: [],
      lastVictoryEnemyType: "boss",
    });
    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    restoreRun(snap, {}, {});
    expect(readActiveRunScreen()).toBe("destination");
  });

  it("snapshots and restores pending gear rewards on the rewards screen", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    setRewardState({
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: [instance],
      gold: 5,
    });
    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({
          rewardType: "gear",
          gearChoices: [instance],
          gold: 5,
        }),
      }),
    );

    setRewardState(createEmptyRewardState());
    restoreRun(snap, {}, {});
    expect(readRunSession().rewardState.rewardType).toBe("gear");
    expect(readRunSession().rewardState.choices).toEqual([instance]);
  });

  it("snapshots and restores companion reward handoffs", () => {
    const primary = cardLibrary.find((card) => card.id === "slash")!;
    const companion = cardLibrary.find((card) => card.effects.some((effect) => effect.kind === "summon-companion"))!;
    setRewardState({
      ...createEmptyRewardState(),
      rewardType: "card",
      choices: [primary],
    });
    setCompanionRewardCards([companion]);

    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.interruptedFlow.kind).toBe("primary-reward");
    if (snap.interruptedFlow.kind === "primary-reward") {
      expect(snap.interruptedFlow.pending.rewardType).toBe("card");
      if (snap.interruptedFlow.pending.rewardType === "card") {
        expect(snap.interruptedFlow.pending.choiceIds).toEqual([primary.id]);
      }
      expect(snap.interruptedFlow.pending.companionChoiceIds).toEqual([companion.id]);
    }

    setRewardState(createEmptyRewardState());
    setCompanionRewardCards(null);
    restoreRun(snap, {}, {});

    const restoredRewardState = readRunSession().rewardState;
    expect(restoredRewardState.rewardType).toBe("card");
    if (restoredRewardState.rewardType === "card") {
      expect(restoredRewardState.choices.map((choice) => choice.id)).toEqual([primary.id]);
    }
    expect(readRunSession().companionRewardCards?.map((choice) => choice.id)).toEqual([companion.id]);
  });

  it("restores wildwood gear rewards from interruptedFlow", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    const activeRun = {
      ...snapshotRun(ROUTE_SCREENS.LABYRINTH_MAP),
      currentScreen: "rewards" as const,
      interruptedFlow: {
        kind: "primary-reward" as const,
        pending: {
          rewardType: "gear" as const,
          gearChoices: [instance],
          companionChoiceIds: [],
          selectedId: null,
          gold: 0,
          materials: emptyInventory(),
          destinations: [],
          selectedBossId: null,
          lastVictoryEnemyType: null,
          lastVictoryContentSystem: "wildwood" as const,
        },
      },
      wildwoodDraft: {
        phase: "reward" as const,
        draftChoices: [],
        remainingBossIds: ["iron-bear"] as Array<"forge-golem" | "frostwarden" | "blight-treant" | "iron-bear">,
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
    };

    setRewardState(createEmptyRewardState());
    restoreRun(activeRun, {}, {});
    expect(readRunSession().rewardState.rewardType).toBe("gear");
    expect(readRunSession().rewardState.choices).toEqual([instance]);
  });

  it("resumes a Wildwood card reward onto the Victory screen from interruptedFlow", () => {
    restoreRun(
      {
        ...snapshotRun(ROUTE_SCREENS.REWARDS),
        contentSystemType: "wildwood",
        currentScreen: "rewards",
        interruptedFlow: {
          kind: "primary-reward",
          pending: {
            rewardType: "card",
            choiceIds: ["slash", "bash", "block"],
            companionChoiceIds: [],
            selectedId: null,
            gold: 0,
            materials: emptyInventory(),
            destinations: [],
            selectedBossId: null,
            lastVictoryEnemyType: "boss",
            lastVictoryContentSystem: "wildwood",
          },
        },
        wildwoodDraft: {
          phase: "reward",
          draftChoices: [],
          remainingBossIds: ["iron-bear"] as Array<"forge-golem" | "frostwarden" | "blight-treant" | "iron-bear">,
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: [],
          currentRewardTraitIds: [],
        },
      },
      {},
      {},
    );

    expect(readActiveRunScreen()).toBe(ROUTE_SCREENS.REWARDS);
    expect(readActiveRun().contentSystemType).toBe("wildwood");
    expect(readRunSession().wildwoodDraft?.phase).toBe("reward");
    const rewardState = readRunSession().rewardState;
    expect(rewardState.rewardType).toBe("card");
    if (rewardState.rewardType === "card") {
      expect(rewardState.choices.map((choice) => choice.id)).toEqual(["slash", "bash", "block"]);
    }
  });

  it("drops unrestorable pending reward choices without soft-locking", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(ROUTE_SCREENS.REWARDS),
      interruptedFlow: {
        kind: "primary-reward",
        pending: {
          rewardType: "card",
          choiceIds: ["not-a-real-card-id"],
          companionChoiceIds: [],
          selectedId: null,
          gold: 0,
          materials: emptyInventory(),
          destinations: [],
          selectedBossId: null,
          lastVictoryEnemyType: null,
          lastVictoryContentSystem: null,
        },
      },
    };

    setRewardState(createEmptyRewardState());
    restoreRun(activeRun, {}, {});

    expect(readRunSession().rewardState.choices).toEqual([]);
  });

  it("restores a mystery visit including the chosen summary phase", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(),
      currentScreen: "mystery",
      interruptedFlow: { kind: "none" },
      mysteryVisit: ANCIENT_ALTAR_MYSTERY_VISIT,
    };

    restoreRun(activeRun, {}, {});

    expect(readActiveRunScreen()).toBe("mystery");
    expect(readRunSession().mysteryEvent?.id).toBe("ancient-altar");
    expect(readRunSession().mysteryChosenChoice?.label).toBe("Take the Offering");
  });

  it("restores a mid-visit mystery card picker", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    const activeRun: ActiveRunData = {
      ...snapshotRun(),
      currentScreen: "mystery",
      interruptedFlow: { kind: "none" },
      mysteryVisit: {
        eventId: "ancient-altar",
        chosenChoice: { label: "Browse", effects: [{ kind: "chooseCard" }] },
        cardChoices: [slash],
        grantedTrinketIds: ["bone-charm"],
        grantedGear: [],
        chosenCardId: "slash",
        resolvedTrinketIds: [],
      },
    };

    restoreRun(activeRun, {}, {});

    expect(readActiveRunScreen()).toBe("mystery");
    expect(readRunSession().mysteryEvent?.id).toBe("ancient-altar");
    expect(readRunSession().mysteryCardChoices).toEqual([slash]);
    expect(readRunSession().mysteryGrantedTrinketIds).toEqual(["bone-charm"]);
    expect(readRunSession().mysteryGrantedGearInstances).toEqual([]);
    expect(readRunSession().mysteryChosenCardId).toBe("slash");
  });

  it("restores a pending legacy mystery card removal", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(),
      currentScreen: "mystery",
      interruptedFlow: { kind: "none" },
      mysteryVisit: {
        eventId: "ancient-altar",
        chosenChoice: { label: "Offer", effects: [{ kind: "removeCard" }] },
        pendingRemoval: true,
        cardChoices: null,
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: null,
        resolvedTrinketIds: [],
      },
    };

    restoreRun(activeRun, {}, {});

    expect(readRunSession().mysteryPendingRemoval).toBe(true);
    expect(snapshotRun().mysteryVisit?.pendingRemoval).toBe(true);
  });

  it("returns a legacy mystery screen with no visit to the destination map", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(),
      currentScreen: "mystery",
      interruptedFlow: { kind: "none" },
      mysteryVisit: null,
    };

    restoreRun(activeRun, {}, {});

    expect(readActiveRunScreen()).toBe("destination");
    expect(readRunSession().mysteryEvent).toBeNull();
  });

  it("repairs unresolved overgrown-temple random trinkets on restore", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(),
      currentScreen: "mystery",
      interruptedFlow: { kind: "none" },
      mysteryVisit: {
        eventId: "overgrown-temple",
        chosenChoice: null,
        cardChoices: null,
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: null,
        resolvedTrinketIds: [],
      },
    };

    restoreRun(activeRun, {}, {});

    const search = readRunSession().mysteryEvent?.choices.find((choice) => choice.label === "Search the Crypt");
    const trinket = search?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(["bone-charm", "sin-eaters-lantern"]).toContain(trinket.trinketId);
  });

  it("abandons a mystery visit with an unknown event id instead of re-rolling", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(),
      currentScreen: "mystery",
      interruptedFlow: { kind: "none" },
      lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
      completedDestinations: ["Mystery"],
      destinationIndexInAct: 1,
      mysteryVisit: {
        ...ANCIENT_ALTAR_MYSTERY_VISIT,
        eventId: "removed-mystery-event",
      },
    };

    restoreRun(activeRun, {}, {});

    expect(readActiveRunScreen()).toBe("destination");
    expect(readRunSession().mysteryEvent).toBeNull();
    expect(readRunSession().mysteryChosenChoice).toBeNull();
    expect(readRunSession().rewardState.destinations).toEqual(["Mystery", "Campfire", "Normal Combat"]);
    expect(readActiveRun().completedDestinations).toEqual([]);
    expect(readActiveRun().destinationIndexInAct).toBe(0);
  });

  it("infers battle screen when currentScreen is null and combat is active", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(),
      currentScreen: null,
      interruptedFlow: { kind: "none" },
      activeCombat: {
        battleState: { ...defaultBattleState(), enemyHealth: 12 },
        pendingBattleTransition: null,
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    };

    restoreRun(activeRun, {}, {});

    expect(readActiveRunScreen()).toBe("battle");
  });

  it("restores a corruption result so the altar cannot re-roll", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    const activeRun: ActiveRunData = {
      ...snapshotRun(),
      currentScreen: "corruption",
      interruptedFlow: { kind: "none" },
      corruptionResult: {
        originalCard: slash,
        corruptedCard: { ...slash, corrupted: true },
        transformed: false,
        delta: -1,
      },
    };

    restoreRun(activeRun, {}, {});

    expect(readRunSession().corruptionResult).toMatchObject({
      originalCard: { id: slash.id },
      corruptedCard: { id: slash.id, corrupted: true },
      transformed: false,
      delta: -1,
    });
  });
});
