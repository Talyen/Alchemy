import "../../../../helpers/mock-audio";

import "../../../../helpers/mock-flush-save";
import {
  setBattleActiveForTest as mutateHasActiveBattle,
  replaceBattleForTest as mutateSyncedBattleState,
} from "../../../../helpers/run-domain-store-test";
import { restoreActiveBattle } from "@/features/alchemy/shared/stores/battle-restore";
import { beforeEach, describe, expect, it } from "vitest";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { ActiveRunDataSchema } from "@/lib/validation/save-schemas/active-run";
import { defaultBattleState } from "@/lib/battle";
import { finalizeRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { REWARD_ROUTES, ROUTE_SCREENS } from "@/lib/routing";
import { createEmptyRewardState, readActivityData, type ActiveRunData } from "@/lib/active-run-session";
import { restoreRun, snapshotRun, teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { getCurrentRunPhase } from "../../../../helpers/run-session-assertions";
import {
  getRunSession,
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { cardById, cardLibrary, getStartingDeck } from "@/lib/game-data";
import { findMysteryEvent } from "@/lib/mystery";
import { emptyInventory } from "@/lib/homestead/inventory";
import { ANCIENT_ALTAR_MYSTERY_VISIT } from "./active-run-data-fixture";
import { acceptCommand, createGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import {
  beginRewardClaim as mutateBeginRewardClaim,
  setCompanionRewardCards as mutateCompanionRewardCards,
  setHasActiveRun as mutateHasActiveRun,
  setRewardState as mutateRewardState,
  setRunProgressActivity,
  setScreen as mutateSetScreen,
} from "@/features/alchemy/shared/stores/run-session-write-port";

import { resetProgress as mutateResetProgress } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";
import { savedActivityFixture, savedActivityData } from "../../../../fixtures/run-activity";
const resetProgress = createGameplayCommand(
  (...args: Parameters<typeof mutateResetProgress>) => acceptCommand(mutateResetProgress(...args)),
  undefined,
  defaultGameSession,
);
const setSyncedBattleState = createGameplayCommand(
  (...args: Parameters<typeof mutateSyncedBattleState>) => acceptCommand(mutateSyncedBattleState(...args)),
  undefined,
  defaultGameSession,
);
const setHasActiveRun = createGameplayCommand(
  (draft, active: boolean) => {
    mutateHasActiveRun(draft, active);
    if (active) setRunProgressActivity(draft, "destination");
    return acceptCommand();
  },
  undefined,
  defaultGameSession,
);
const setHasActiveBattle = createGameplayCommand(
  (...args: Parameters<typeof mutateHasActiveBattle>) => acceptCommand(mutateHasActiveBattle(...args)),
  undefined,
  defaultGameSession,
);
const setRewardState = createGameplayCommand(
  (draft, state: Parameters<typeof mutateRewardState>[1]) => {
    mutateRewardState(draft, state);
    setRunProgressActivity(draft, "rewards");
    return acceptCommand();
  },
  undefined,
  defaultGameSession,
);
const beginRewardClaim = createGameplayCommand(
  (...args: Parameters<typeof mutateBeginRewardClaim>) => acceptCommand(mutateBeginRewardClaim(...args)),
  undefined,
  defaultGameSession,
);
const setCompanionRewardCards = createGameplayCommand(
  (...args: Parameters<typeof mutateCompanionRewardCards>) => acceptCommand(mutateCompanionRewardCards(...args)),
  undefined,
  defaultGameSession,
);
const initializeActiveBattle = createGameplayCommand(
  (...args: Parameters<typeof restoreActiveBattle>) => acceptCommand(restoreActiveBattle(...args)),
  undefined,
  defaultGameSession,
);
const setScreen = createGameplayCommand(
  (...args: Parameters<typeof mutateSetScreen>) => acceptCommand(mutateSetScreen(...args)),
  undefined,
  defaultGameSession,
);

beforeEach(() => {
  resetRunDomainStore();
});

describe("session facade API", () => {
  beforeEach(() => {
    teardownRun(defaultGameSession);
    resetProgress();
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, gold: 40, initialized: true });
    setHasActiveRun(true);
  });

  it("getRunSession aggregates run, battle, and session fields for orchestration", () => {
    setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    const session = getRunSession(ROUTE_SCREENS.MENU, defaultGameSession);
    expect(session.run.runPlayerHealth).toBe(18);
    expect(session.run.gold).toBe(40);
    expect(session.battle.battleState.playerHealth).toBe(10);
    expect(session.session.activity.kind !== "inactive").toBe(true);
    expect(session.phase).toBe("meta");
  });

  it("reads gold from the shared purse", () => {
    expect(getRunSession(ROUTE_SCREENS.MENU, defaultGameSession).run.gold).toBe(40);
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
    setRunSession({ activity: { kind: "destination" } });
    const snapshot = snapshotRun(defaultGameSession);
    expect(snapshot).toMatchObject({
      characterId: "knight",
      runDeck: [],
      runPlayerHealth: 18,
      runMaxHealth: 24,
      contentSystemType: "campaign",
      activity: savedActivityFixture(ROUTE_SCREENS.DESTINATION, {
        kind: "destination",
        destinations: ["Campfire", "Card Shop"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      }),
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
    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity).toEqual(
      expect.objectContaining({
        kind: "rewards",
        data: expect.objectContaining({
          rewardType: "gear",
          gearChoices: [instance],
          gold: 5,
        }),
      }),
    );
  });

  it("retains an unconsumed reward while a claim lock is held", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    setRewardState({ ...createEmptyRewardState(["Campfire"]), rewardType: "gear", choices: [instance], gold: 5 });
    beginRewardClaim();
    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity).toMatchObject({
      kind: "rewards",
      data: { gearChoices: [instance], gold: 5 },
    });
    expect(snap.activity.kind).toBe("rewards");
  });

  it("preserves an empty boss reward so Skip can finish the act after reload", () => {
    setRewardState({
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: [],
      lastVictoryEnemyType: "boss",
    });

    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity.kind).toBe("rewards");
    expect(snap.activity).toMatchObject({
      kind: "rewards",
      data: { rewardType: "gear", gearChoices: [], lastVictoryEnemyType: "boss" },
    });

    const parsed = ActiveRunDataSchema.parse(JSON.parse(JSON.stringify(snap)));
    expect(parsed.activity).toEqual(snap.activity);
    restoreRun(snap, {}, {}, defaultGameSession);
    expect(readActiveRunScreen(defaultGameSession)).toBe("rewards");
    const rewardState = readRunSession(defaultGameSession).rewardFlow.state;
    expect(rewardState.choices).toEqual([]);
    expect(finalizeRewardState({ rewardState, companionRewardCards: null }).route).toBe(REWARD_ROUTES.ACT_COMPLETE);
  });

  it("restores Archery metadata for a card queued behind a full hand", () => {
    const arrow = { ...cardById["venom-arrow"]!, uid: 42 };
    const parsed = PersistedBattleStateSchema.parse({ ...defaultBattleState(), pendingHandCards: [arrow] });
    expect(parsed.pendingHandCards[0]?.tags).toBeUndefined();
    initializeActiveBattle(parsed);
    const queued = readBattle(defaultGameSession).battleState.pendingHandCards[0];
    expect(queued?.tags).toEqual(["archery"]);
    expect(queued?.uid).toBe(42);
    expect(queued?.effects).toEqual(arrow.effects);
  });

  it("preserves enemy-phase combat without a transition on restore", () => {
    const enemyPhase = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };
    initializeActiveBattle(enemyPhase);
    setScreen(ROUTE_SCREENS.BATTLE);
    const snap = snapshotRun(defaultGameSession);
    expect(savedActivityData(snap, "battle")?.battleState.turnPhase).toBe("enemy");

    restoreRun(snap, {}, {}, defaultGameSession);
    expect(readBattle(defaultGameSession).battleState.turnPhase).toBe("enemy");
  });

  it("rebinds current Talent and Trinket tuning without replaying opening rewards or clearing prepared bonuses", () => {
    const battle = defaultBattleState();
    battle.playerHealth = 10;
    battle.playerStatuses = { ...battle.playerStatuses, block: 7, armor: 3, forge: 2 };
    battle.enemyHealth = 17;
    battle.enemyStatuses.freeze = 2;
    battle.trinketEffects.boneCharmHealOnKill = 9;
    battle.flags.nextPhysicalDealsBleed = true;
    battle.flags.nextHitPhysicalBonus = 4;
    battle.flags.pendingWishMana = 2;
    battle.talentEffects = {
      ...battle.talentEffects,
      forgeBurnDamagePercent: 100,
      armorPhysicalDamagePercent: 100,
      nextAttackPhysicalOnDodge: 4,
    };
    initializeActiveBattle(battle);
    setScreen(ROUTE_SCREENS.BATTLE);
    const saved = { ...snapshotRun(defaultGameSession), runBoons: ["bone-charm"] };
    restoreRun(
      saved,
      {},
      {
        forge: ["forge-to-burn"],
        physical: ["physical-armored-fists"],
        dodge: ["dodge-open-flank"],
        bleed: ["bleed-physical-bonus"],
        health: ["health-start"],
        freeze: ["freeze-start-amount"],
      },
      defaultGameSession,
    );
    const restored = readBattle(defaultGameSession).battleState;
    expect(restored.talentEffects).toMatchObject({
      forgeBurnDamagePercent: 50,
      armorPhysicalDamagePercent: 50,
      nextAttackPhysicalOnDodge: 2,
      partingCutDamagePercent: 50,
    });
    expect(restored.trinketEffects.boneCharmHealOnKill).toBe(3);
    expect(restored.playerHealth).toBe(10);
    expect(restored.playerStatuses).toEqual(battle.playerStatuses);
    expect(restored.enemyHealth).toBe(17);
    expect(restored.enemyStatuses.freeze).toBe(2);
    expect(restored.flags).toMatchObject({ nextPhysicalDealsBleed: true, nextHitPhysicalBonus: 4, pendingWishMana: 2 });
    expect(snapshotRun(defaultGameSession).rng).toEqual(saved.rng);
  });

  it("snapshots and restores pending gear rewards on the rewards screen", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    setRewardState({
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: [instance],
      gold: 5,
    });
    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity).toEqual(
      expect.objectContaining({
        kind: "rewards",
        data: expect.objectContaining({
          rewardType: "gear",
          gearChoices: [instance],
          gold: 5,
        }),
      }),
    );

    setRewardState(createEmptyRewardState());
    restoreRun(snap, {}, {}, defaultGameSession);
    expect(readRunSession(defaultGameSession).rewardFlow.state.rewardType).toBe("gear");
    expect(readRunSession(defaultGameSession).rewardFlow.state.choices).toEqual([instance]);
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

    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity.kind).toBe("rewards");
    if (snap.activity.kind === "rewards") {
      expect(snap.activity.data.rewardType).toBe("card");
      if (snap.activity.data.rewardType === "card") {
        expect(snap.activity.data.choiceIds).toEqual([primary.id]);
      }
      expect(snap.activity.data.companionChoiceIds).toEqual([companion.id]);
    }

    setRewardState(createEmptyRewardState());
    setCompanionRewardCards(null);
    restoreRun(snap, {}, {}, defaultGameSession);

    const restoredRewardState = readRunSession(defaultGameSession).rewardFlow.state;
    expect(restoredRewardState.rewardType).toBe("card");
    if (restoredRewardState.rewardType === "card") {
      expect(restoredRewardState.choices.map((choice) => choice.id)).toEqual([primary.id]);
    }
    expect(readRunSession(defaultGameSession).rewardFlow.companionCards?.map((choice) => choice.id)).toEqual([
      companion.id,
    ]);
  });

  it("restores wildwood gear rewards from interruptedFlow", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    const activeRun = {
      ...snapshotRun(defaultGameSession),
      wildwoodDraft: {
        phase: "reward" as const,
        draftChoices: [],
        remainingBossIds: ["iron-bear"] as Array<"forge-golem" | "frostwarden" | "blight-treant" | "iron-bear">,
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
      activity: savedActivityFixture("rewards", {
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
      }),
    };

    setRewardState(createEmptyRewardState());
    restoreRun(activeRun, {}, {}, defaultGameSession);
    expect(readRunSession(defaultGameSession).rewardFlow.state.rewardType).toBe("gear");
    expect(readRunSession(defaultGameSession).rewardFlow.state.choices).toEqual([instance]);
  });

  it("resumes a Wildwood card reward onto the Victory screen from interruptedFlow", () => {
    restoreRun(
      {
        ...snapshotRun(defaultGameSession),
        contentSystemType: "wildwood",
        wildwoodDraft: {
          phase: "reward",
          draftChoices: [],
          remainingBossIds: ["iron-bear"] as Array<"forge-golem" | "frostwarden" | "blight-treant" | "iron-bear">,
          previousBossId: null,
          currentBossId: null,
          currentCombatTraitIds: [],
          currentRewardTraitIds: [],
        },
        activity: savedActivityFixture("rewards", {
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
        }),
      },
      {},
      {},
      defaultGameSession,
    );

    expect(readActiveRunScreen(defaultGameSession)).toBe(ROUTE_SCREENS.REWARDS);
    expect(readActiveRun(defaultGameSession).contentSystemType).toBe("wildwood");
    expect(readRunSession(defaultGameSession).wildwoodDraft?.phase).toBe("reward");
    const rewardState = readRunSession(defaultGameSession).rewardFlow.state;
    expect(rewardState.rewardType).toBe("card");
    if (rewardState.rewardType === "card") {
      expect(rewardState.choices.map((choice) => choice.id)).toEqual(["slash", "bash", "block"]);
    }
  });

  it("drops unrestorable pending reward choices without soft-locking", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(defaultGameSession),
      activity: savedActivityFixture("rewards", {
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
      }),
    };

    setRewardState(createEmptyRewardState());
    restoreRun(activeRun, {}, {}, defaultGameSession);

    expect(readRunSession(defaultGameSession).rewardFlow.state.choices).toEqual([]);
  });

  it("restores a mystery visit including the chosen summary phase", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(defaultGameSession),
      activity: savedActivityFixture("mystery", ANCIENT_ALTAR_MYSTERY_VISIT),
    };

    restoreRun(activeRun, {}, {}, defaultGameSession);

    expect(readActiveRunScreen(defaultGameSession)).toBe("mystery");
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent?.id).toBe(
      "ancient-altar",
    );
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice?.label).toBe(
      "Take the Offering",
    );
  });

  it("restores a mid-visit mystery card picker", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    const activeRun: ActiveRunData = {
      ...snapshotRun(defaultGameSession),
      activity: savedActivityFixture("mystery", {
        event: findMysteryEvent("ancient-altar")!,
        chosenChoice: { label: "Browse", effects: [{ kind: "chooseCard" }] },
        cardChoices: [slash],
        grantedTrinketIds: ["bone-charm"],
        grantedGear: [],
        chosenCardId: "slash",
      }),
    };

    restoreRun(activeRun, {}, {}, defaultGameSession);

    expect(readActiveRunScreen(defaultGameSession)).toBe("mystery");
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent?.id).toBe(
      "ancient-altar",
    );
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices).toEqual([
      slash,
    ]);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryGrantedTrinketIds).toEqual([
      "bone-charm",
    ]);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryGrantedGearInstances,
    ).toEqual([]);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenCardId).toBe("slash");
  });

  it("restores the destination offer when a saved Mystery visit is missing", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(defaultGameSession),
      lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
      completedDestinations: ["Mystery"],
      destinationIndexInAct: 1,
      activity: savedActivityFixture("mystery", null),
    };

    restoreRun(activeRun, {}, {}, defaultGameSession);

    expect(readActiveRunScreen(defaultGameSession)).toBe("destination");
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent).toBeNull();
    expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).toEqual([
      "Mystery",
      "Campfire",
      "Normal Combat",
    ]);
    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual([]);
    expect(readActiveRun(defaultGameSession).destinationIndexInAct).toBe(0);
  });

  it("restores overgrown-temple random gear without introducing trinkets", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(defaultGameSession),
      activity: savedActivityFixture("mystery", {
        event: findMysteryEvent("overgrown-temple")!,
        chosenChoice: null,
        cardChoices: null,
        grantedTrinketIds: [],
        grantedGear: [],
        chosenCardId: null,
      }),
    };

    restoreRun(activeRun, {}, {}, defaultGameSession);

    const search = readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent?.choices.find(
      (choice) => choice.label === "Search the Crypt",
    );
    expect(search?.effects).toContainEqual({ kind: "gainRandomGear" });
    expect(search?.effects.some((effect) => effect.kind === "gainTrinket")).toBe(false);
  });

  it("resumes a saved Mystery offer after its event leaves the live pool", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(defaultGameSession),
      lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
      completedDestinations: ["Mystery"],
      destinationIndexInAct: 1,
      activity: savedActivityFixture("mystery", {
        ...ANCIENT_ALTAR_MYSTERY_VISIT,
        event: { ...ANCIENT_ALTAR_MYSTERY_VISIT.event, id: "removed-mystery-event" },
      }),
    };

    restoreRun(activeRun, {}, {}, defaultGameSession);

    expect(readActiveRunScreen(defaultGameSession)).toBe("mystery");
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent?.id).toBe(
      "removed-mystery-event",
    );
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice?.label).toBe(
      "Take the Offering",
    );
    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual(["Mystery"]);
    expect(readActiveRun(defaultGameSession).destinationIndexInAct).toBe(1);
  });

  it("infers battle screen when currentScreen is null and combat is active", () => {
    const activeRun: ActiveRunData = {
      ...snapshotRun(defaultGameSession),
      activity: savedActivityFixture("battle", {
        battleState: { ...defaultBattleState(), enemyHealth: 12 },

        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      }),
    };

    restoreRun(activeRun, {}, {}, defaultGameSession);

    expect(readActiveRunScreen(defaultGameSession)).toBe("battle");
  });

  it("restores a corruption result so the altar cannot re-roll", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    const activeRun: ActiveRunData = {
      ...snapshotRun(defaultGameSession),
      activity: savedActivityFixture("corruption", {
        originalCard: slash,
        corruptedCard: { ...slash, corrupted: true },
        transformed: false,
        delta: -1,
      }),
    };

    restoreRun(activeRun, {}, {}, defaultGameSession);

    expect(readActivityData(readRunSession(defaultGameSession).activity, "corruption")).toMatchObject({
      originalCard: { id: slash.id },
      corruptedCard: { id: slash.id, corrupted: true },
      transformed: false,
      delta: -1,
    });
  });
});
