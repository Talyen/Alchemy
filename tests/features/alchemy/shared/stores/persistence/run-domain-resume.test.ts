import "../../../../../helpers/mock-audio";
import "../../../../../helpers/mock-flush-save";
import {
  bindGameplayMutationForTest,
  setBattleActiveForTest as mutateHasActiveBattle,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../../helpers/run-domain-store-test";
import { restoreActiveBattle } from "@/features/alchemy/shared/stores/persistence/battle-restore";
import { beforeEach, describe, expect, it } from "vitest";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { ActiveRunDataSchema } from "@/lib/validation/save-schemas/active-run";
import { defaultBattleState } from "@/lib/battle";
import { finalizeRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { REWARD_ROUTES, ROUTE_SCREENS } from "@/lib/routing";
import { createEmptyRewardState, readActivityData, type ActiveRunData } from "@/lib/active-run-session";
import { restoreRun, snapshotRun, teardownRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { getCurrentRunPhase } from "../../../../../helpers/run-session-assertions";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunSession,
} from "@/features/alchemy/shared/stores/session/run-reads";
import { cardById, cardLibrary, getStartingDeck } from "@/lib/game-data";
import { findMysteryEvent } from "@/lib/mystery";
import { emptyInventory } from "@/lib/homestead/inventory";
import { ANCIENT_ALTAR_MYSTERY_VISIT } from "../session/active-run-data-fixture";
import { acceptCommand, createGameplayCommand } from "@/features/alchemy/shared/stores/session/gameplay-command";
import {
  beginRewardClaim as mutateBeginRewardClaim,
  setCompanionRewardCards as mutateCompanionRewardCards,
  setHasActiveRun as mutateHasActiveRun,
  setRewardState as mutateRewardState,
  setRunProgressActivity,
  setScreen as mutateSetScreen,
  resetProgress as mutateResetProgress,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { defaultGameSession } from "@/app/application-session";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-generation";
import { gridLabyrinthMapFixture } from "../../../../../fixtures/labyrinth-map";
import { savedActivityFixture, savedActivityData } from "../../../../../fixtures/run-activity";
const resetProgress = bindGameplayMutationForTest(mutateResetProgress);
const setHasActiveRun = createGameplayCommand(
  (draft, active: boolean) => {
    mutateHasActiveRun(draft, active);
    if (active) setRunProgressActivity(draft, "destination");
    return acceptCommand();
  },
  undefined,
  defaultGameSession,
);
const setHasActiveBattle = bindGameplayMutationForTest(mutateHasActiveBattle);
const setRewardState = createGameplayCommand(
  (draft, state: Parameters<typeof mutateRewardState>[1]) => {
    mutateRewardState(draft, state);
    setRunProgressActivity(draft, "rewards");
    return acceptCommand();
  },
  undefined,
  defaultGameSession,
);
const beginRewardClaim = bindGameplayMutationForTest(mutateBeginRewardClaim);
const setCompanionRewardCards = bindGameplayMutationForTest(mutateCompanionRewardCards);
const initializeActiveBattle = bindGameplayMutationForTest(restoreActiveBattle);
const setScreen = bindGameplayMutationForTest(mutateSetScreen);

function restoreSnapshot(overrides: Partial<ActiveRunData>) {
  const saved = { ...snapshotRun(defaultGameSession), ...overrides };
  restoreRun(saved, {}, {}, defaultGameSession);
  return saved;
}

function currentMystery() {
  return readActivityData(readRunSession(defaultGameSession).activity, "mystery");
}

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
    // Exercise missing metadata explicitly; the save schema now preserves authored tags.
    const parsed = PersistedBattleStateSchema.parse({
      ...defaultBattleState(),
      pendingHandCards: [{ ...arrow, tags: undefined }],
    });
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
    battle.flags.darkRecoveryMana = 2;
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
      forgeBurnDamagePercent: 25,
      armorPhysicalDamagePercent: 50,
      nextAttackPhysicalOnDodge: 2,
      partingCutDamagePercent: 50,
    });
    expect(restored.trinketEffects.boneCharmHealOnKill).toBe(3);
    expect(restored.playerHealth).toBe(10);
    expect(restored.playerStatuses).toEqual(battle.playerStatuses);
    expect(restored.enemyHealth).toBe(17);
    expect(restored.enemyStatuses.freeze).toBe(2);
    expect(restored.flags).toMatchObject({
      nextPhysicalDealsBleed: true,
      nextHitPhysicalBonus: 4,
      darkRecoveryMana: 2,
    });
    expect(snapshotRun(defaultGameSession).rng).toEqual(saved.rng);
  });

  it.each([false, true])("snapshots and restores gear rewards with claim lock %s", (claimed) => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic", affixes: [] };
    setRewardState({
      ...createEmptyRewardState(claimed ? ["Campfire"] : []),
      rewardType: "gear",
      choices: [instance],
      gold: 5,
    });
    if (claimed) beginRewardClaim();
    const snap = snapshotRun(defaultGameSession);
    expect(snap.activity.kind).toBe("rewards");
    expect(snap.activity).toMatchObject({
      kind: "rewards",
      data: { rewardType: "gear", gearChoices: [instance], gold: 5 },
    });
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

  it.each(["gear", "card"] as const)("restores a Wildwood %s reward and its routing", (rewardType) => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic", affixes: [] };
    const cardIds = ["slash", "bash", "block"];
    const activeRun = {
      ...snapshotRun(defaultGameSession),
      ...(rewardType === "card" ? { contentSystemType: "wildwood" as const } : {}),
      wildwoodDraft: {
        phase: "reward" as const,
        draftChoices: [],
        remainingBossIds: ["iron-bear" as const],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
      activity: savedActivityFixture("rewards", {
        rewardType,
        ...(rewardType === "gear" ? { gearChoices: [instance] } : { choiceIds: cardIds }),
        companionChoiceIds: [],
        selectedId: null,
        gold: 0,
        materials: emptyInventory(),
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: rewardType === "card" ? "boss" : null,
        lastVictoryContentSystem: "wildwood",
      }),
    };
    if (rewardType === "gear") setRewardState(createEmptyRewardState());
    restoreRun(activeRun, {}, {}, defaultGameSession);
    const reward = readRunSession(defaultGameSession).rewardFlow.state;
    expect(reward.rewardType).toBe(rewardType);
    if (rewardType === "gear") expect(reward.choices).toEqual([instance]);
    else {
      expect(readActiveRunScreen(defaultGameSession)).toBe(ROUTE_SCREENS.REWARDS);
      expect(readActiveRun(defaultGameSession).contentSystemType).toBe("wildwood");
      expect(readRunSession(defaultGameSession).wildwoodDraft?.phase).toBe("reward");
      if (reward.rewardType === "card") expect(reward.choices.map((choice) => choice.id)).toEqual(cardIds);
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
    restoreSnapshot({
      activity: savedActivityFixture("mystery", ANCIENT_ALTAR_MYSTERY_VISIT),
    });

    expect(readActiveRunScreen(defaultGameSession)).toBe("mystery");
    expect(currentMystery().mysteryEvent?.id).toBe("ancient-altar");
    expect(currentMystery().mysteryChosenChoice?.label).toBe("Take the Offering");
  });

  it("restores a mid-visit mystery card picker", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    restoreSnapshot({
      activity: savedActivityFixture("mystery", {
        event: findMysteryEvent("ancient-altar")!,
        chosenChoice: { label: "Browse", effects: [{ kind: "chooseCard" }] },
        cardChoices: [slash],
        grantedGear: [],
        chosenCardId: "slash",
      }),
    });

    expect(readActiveRunScreen(defaultGameSession)).toBe("mystery");
    expect(currentMystery().mysteryEvent?.id).toBe("ancient-altar");
    expect(currentMystery().mysteryCardChoices).toEqual([slash]);
    expect(currentMystery().mysteryGrantedGearInstances).toEqual([]);
    expect(currentMystery().mysteryChosenCardId).toBe("slash");
  });

  it("restores the destination offer when a saved Mystery visit is missing", () => {
    restoreSnapshot({
      lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
      completedDestinations: ["Mystery"],
      destinationIndexInAct: 1,
      activity: savedActivityFixture("mystery", null),
    });

    expect(readActiveRunScreen(defaultGameSession)).toBe("destination");
    expect(currentMystery().mysteryEvent).toBeNull();
    expect(readRunSession(defaultGameSession).rewardFlow.state.destinations).toEqual([
      "Mystery",
      "Campfire",
      "Normal Combat",
    ]);
    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual([]);
    expect(readActiveRun(defaultGameSession).destinationIndexInAct).toBe(0);
  });

  it("returns a missing Labyrinth Mystery to its uncleared room on the map", () => {
    const map = gridLabyrinthMapFixture();
    const node = Object.values(map.nodes).find((entry) => entry.type === "mystery")!;
    map.currentNodeId = "labyrinth-floor-1-n4";
    map.nodes[map.currentNodeId]!.cleared = true;
    const activeRun = restoreSnapshot({
      contentSystemType: "labyrinth",
      labyrinthMap: map,
      labyrinthPendingNode: node.id,
      activity: savedActivityFixture("mystery", null),
    });

    expect(readActiveRunScreen(defaultGameSession)).toBe("labyrinth-map");
    const session = readRunSession(defaultGameSession);
    expect(session.activity.kind).toBe("labyrinth-map");
    expect(session.activeLabyrinthPendingNode).toBeNull();
    expect(session.selectedLabyrinthNodeId).toBeNull();
    expect(session.labyrinthMap?.nodes[node.id]?.cleared).toBe(false);
    expect(canEnterLabyrinthNode(session.labyrinthMap!, node.id)).toBe(true);
    expect(readActiveRun(defaultGameSession).destinationIndexInAct).toBe(activeRun.destinationIndexInAct);
  });

  it("restores overgrown-temple random gear without introducing trinkets", () => {
    restoreSnapshot({
      activity: savedActivityFixture("mystery", {
        event: findMysteryEvent("overgrown-temple")!,
        chosenChoice: null,
        cardChoices: null,
        grantedGear: [],
        chosenCardId: null,
      }),
    });

    const search = currentMystery().mysteryEvent?.choices.find((choice) => choice.label === "Search the Crypt");
    expect(search?.effects).toContainEqual({ kind: "gainRandomGear" });
    expect(search?.effects.some((effect) => effect.kind === "gainTrinket")).toBe(false);
  });

  it("resumes a saved Mystery offer after its event leaves the live pool", () => {
    restoreSnapshot({
      lastOfferedDestinations: ["Mystery", "Campfire", "Normal Combat"],
      completedDestinations: ["Mystery"],
      destinationIndexInAct: 1,
      activity: savedActivityFixture("mystery", {
        ...ANCIENT_ALTAR_MYSTERY_VISIT,
        event: { ...ANCIENT_ALTAR_MYSTERY_VISIT.event, id: "removed-mystery-event" },
      }),
    });

    expect(readActiveRunScreen(defaultGameSession)).toBe("mystery");
    expect(currentMystery().mysteryEvent?.id).toBe("removed-mystery-event");
    expect(currentMystery().mysteryChosenChoice?.label).toBe("Take the Offering");
    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual(["Mystery"]);
    expect(readActiveRun(defaultGameSession).destinationIndexInAct).toBe(1);
  });

  it("infers battle screen when currentScreen is null and combat is active", () => {
    restoreSnapshot({
      activity: savedActivityFixture("battle", {
        battleState: { ...defaultBattleState(), enemyHealth: 12 },

        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      }),
    });

    expect(readActiveRunScreen(defaultGameSession)).toBe("battle");
  });

  it("restores a corruption result so the altar cannot re-roll", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    restoreSnapshot({
      activity: savedActivityFixture("corruption", {
        originalCard: slash,
        corruptedCard: { ...slash, corrupted: true },
        transformed: false,
        delta: -1,
      }),
    });

    expect(readActivityData(readRunSession(defaultGameSession).activity, "corruption")).toMatchObject({
      originalCard: { id: slash.id },
      corruptedCard: { id: slash.id, corrupted: true },
      transformed: false,
      delta: -1,
    });
  });
});
