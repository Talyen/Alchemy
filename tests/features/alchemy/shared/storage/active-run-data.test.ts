import { beforeEach, describe, expect, it } from "vitest";

import { defaultBattleState } from "@/lib/battle";
import { getStartingDeck } from "@/lib/game-data";
import { type ActiveRunData } from "@/lib/active-run-session";
import { decodeRunResumeSnapshot, encodeRunResumeSnapshot } from "@/features/alchemy/shared/stores/run-resume-codec";
import { getRunSession } from "@/features/alchemy/shared/stores/run-session-model";
import type { Screen } from "@/lib/routing";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { useRunBattleDomainStore } from "../../../../helpers/gameplay-store-test";
import { ANCIENT_ALTAR_MYSTERY_VISIT } from "../stores/active-run-data-fixture";

/** Encode the live store through the canonical resume codec. */
function encodeState(screen?: Screen): ActiveRunData {
  return encodeRunResumeSnapshot(getRunSession(screen), screen);
}

beforeEach(() => {
  resetRunDomainStore();
});

describe("encodeRunResumeSnapshot", () => {
  it("copies only persisted active-run fields", () => {
    const runDeck = getStartingDeck("knight");
    setRunProgress({
      characterId: "knight",
      runDeck,
      runGold: 42,
      runPlayerHealth: 18,
      runMaxHealth: 32,
      roomsEncountered: 4,
      currentAct: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat", "Campfire"],
      lastOfferedDestinations: ["Mystery", "Campfire", "Merchant's Shop"],
      destinationRoundsSinceOffered: { Mystery: 2 },
      runBoons: ["bone-charm"],
      encounteredRunEnemyIds: ["goblin"],
      runTalentXP: {},
      runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    });

    const result = encodeState("menu");

    expect(result).toEqual({
      characterId: "knight",
      runDeck,
      runPlayerHealth: 18,
      runMaxHealth: 32,
      runMetaMaxHealth: getRunProgressStoreView().runMetaMaxHealth,
      roomsEncountered: 4,
      currentAct: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat", "Campfire"],
      lastOfferedDestinations: ["Mystery", "Campfire", "Merchant's Shop"],
      destinationRoundsSinceOffered: { Mystery: 2 },
      runBoons: ["bone-charm"],
      encounteredRunEnemyIds: ["goblin"],
      runTalentXP: {},
      selectedDifficulty: null,
      contentSystemType: "campaign",
      rng: getRunProgressStoreView().rng,
      labyrinthMap: null,
      labyrinthPendingNode: null,
      activeCombat: null,
      currentScreen: "menu",
      interruptedFlow: { kind: "none" },
      shopState: null,
      alchemistState: null,
      trinketShopState: null,
      equipmentShopState: null,
      mysteryVisit: null,
      corruptionResult: null,
      wildwoodDraft: null,
      starterDraftChoices: null,
      runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    });
  });

  it("includes contentSystemType field defaulting to campaign", () => {
    const result = encodeState("menu");

    expect(result.contentSystemType).toBe("campaign");
  });

  it("drops shop offerings once the player leaves the shop screen", () => {
    const card = getStartingDeck("knight")[0]!;
    setRunSession({
      shopState: {
        ...getRunSessionStoreView().shopState,
        cards: [card],
      },
    });

    expect(encodeState("shop").shopState?.cards).toHaveLength(1);
    expect(encodeState("destination").shopState).toBeNull();
  });

  it("can set contentSystemType to labyrinth", () => {
    setRunProgress({ contentSystemType: "labyrinth" });

    const result = encodeState("menu");

    expect(result.contentSystemType).toBe("labyrinth");
  });

  it("persists active campaign combat state", () => {
    const battleState = { ...defaultBattleState(), turn: 3, playerHealth: 12 };
    useRunBattleDomainStore.setState({ hasActiveBattle: true, battleState });

    const result = encodeState();

    expect(result.activeCombat?.battleState).toBe(battleState);
  });

  it("persists the current state during enemy phase instead of reverting to battle start", () => {
    const enemyPhaseState = { ...defaultBattleState(), turn: 2, turnPhase: "enemy" as const, hand: [] };
    useRunBattleDomainStore.setState({ hasActiveBattle: true, battleState: enemyPhaseState });

    const result = encodeState();

    expect(result.activeCombat?.battleState).toBe(enemyPhaseState);
    expect(result.activeCombat!.battleState.turn).toBe(2);
    expect(result.activeCombat!.battleState.turnPhase).toBe("enemy");
  });

  it("persists the computed enemy-turn continuation with the intermediate state", () => {
    const resultState = { ...defaultBattleState(), turn: 3, playerHealth: 20, turnPhase: "player" as const };
    const enemyPhaseState = { ...defaultBattleState(), turn: 2, turnPhase: "enemy" as const, hand: [] };
    useRunBattleDomainStore.setState({
      hasActiveBattle: true,
      battleState: enemyPhaseState,
      pendingBattleTransition: {
        kind: "enemy-turn",
        resultState,
        playerTurnSkipped: false,
      },
    });

    const result = encodeState();

    expect(result.activeCombat?.pendingBattleTransition).toEqual({
      kind: "enemy-turn",
      resultState,
      playerTurnSkipped: false,
    });
  });

  it("round-trips the empty opening hand and its resolved draw", () => {
    const deck = getStartingDeck("knight");
    const openingState = { ...defaultBattleState(), deck, hand: [] };
    const resultState = { ...openingState, deck: deck.slice(4), hand: deck.slice(0, 4) };
    useRunBattleDomainStore.setState({
      hasActiveBattle: true,
      battleState: openingState,
      pendingBattleTransition: { kind: "opening-draw", resultState },
    });

    const encoded = encodeState();
    const decoded = decodeRunResumeSnapshot(encoded);

    expect(encoded.activeCombat?.battleState.hand).toEqual([]);
    expect(encoded.activeCombat?.pendingBattleTransition).toEqual({ kind: "opening-draw", resultState });
    expect(decoded.pendingBattleTransition?.kind).toBe("opening-draw");
    if (decoded.pendingBattleTransition?.kind === "opening-draw") {
      expect(decoded.pendingBattleTransition.resultState.hand).toHaveLength(4);
    }
  });

  it("marks enemy-phase saves without a pending transition for boot recovery", () => {
    useRunBattleDomainStore.setState({
      hasActiveBattle: true,
      battleState: { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] },
    });

    const activeRun = encodeState();
    const decoded = decodeRunResumeSnapshot(activeRun);

    expect(decoded.pendingBattleTransition).toEqual({ kind: "legacy-enemy-turn" });
    expect(activeRun.activeCombat?.battleState.turnPhase).toBe("enemy");
  });

  it("persists labyrinth pending node and modifiers during combat", () => {
    setRunProgress({ contentSystemType: "labyrinth" });
    setRunSession({
      activeLabyrinthPendingNode: { row: 1, col: 2 },
      activeLabyrinthModifiers: ["tempered"],
      activeLabyrinthRewardModifiers: ["generous"],
    });
    useRunBattleDomainStore.setState({ hasActiveBattle: true });

    const result = encodeState();

    expect(result.labyrinthPendingNode).toEqual({ row: 1, col: 2 });
    expect(result.activeCombat?.activeLabyrinthModifiers).toEqual(["tempered"]);
    expect(result.activeCombat?.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });

  it("skips active combat when enemy health is zero", () => {
    useRunBattleDomainStore.setState({
      hasActiveBattle: true,
      battleState: { ...defaultBattleState(), turn: 5, enemyHealth: 0 },
    });

    const result = encodeState();

    expect(result.activeCombat).toBeNull();
  });

  it("skips active combat when player is defeated", () => {
    useRunBattleDomainStore.setState({
      hasActiveBattle: true,
      battleState: {
        ...defaultBattleState(),
        turn: 3,
        playerHealth: 0,
        deathsDoorUsed: true,
        deathsDoorActive: false,
      },
    });

    const result = encodeState();

    expect(result.activeCombat).toBeNull();
  });

  it("persists runTalentXP", () => {
    const runTalentXP = { burn: 10, poison: 5 };
    setRunProgress({ runTalentXP });

    const result = encodeState();

    expect(result.runTalentXP).toEqual(runTalentXP);
  });

  it("persists destination resume fields", () => {
    getRunSessionStoreView().setRewardState((prev) => ({ ...prev, destinations: ["Campfire", "Merchant's Shop"] }));

    const result = encodeState("destination");

    expect(result.currentScreen).toBe("destination");
    expect(result.interruptedFlow).toEqual({
      kind: "destination",
      destinations: ["Campfire", "Merchant's Shop"],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    });
  });

  it("persists Wildwood Draft phase state", () => {
    const wildwoodDraft = {
      version: 3 as const,
      phase: "reward" as const,
      draftChoices: [],
      remainingBossIds: ["iron-bear"] as Array<"forge-golem" | "frostwarden" | "blight-treant" | "iron-bear">,
      previousBossId: "forge-golem" as const,
      currentBossId: "frostwarden" as const,
      currentCombatTraitIds: ["tempered" as const],
      currentRewardTraitIds: ["alchemist" as const],
      rewardType: "card" as const,
      rewardChoiceIds: ["slash", "block"],
      rewardGearChoices: [],
      selectedRewardId: "slash",
    };
    setRunProgress({ contentSystemType: "wildwood" });
    setRunSession({ wildwoodDraft });

    const result = encodeState();

    expect(result.wildwoodDraft).toEqual(wildwoodDraft);
  });

  it("persists campaign Wildcard starter-draft choices", () => {
    const [slash, block] = getStartingDeck("knight");
    if (!slash || !block) throw new Error("Knight starting deck fixture is incomplete");
    setRunProgress({ contentSystemType: "campaign", characterId: "wildcard" });
    setRunSession({ starterDraftChoices: [slash, block] });

    const result = encodeState("draft-deck");
    const decoded = decodeRunResumeSnapshot(result);

    expect(result.starterDraftChoices).toEqual([slash, block]);
    expect(decoded.session.starterDraftChoices).toEqual([slash, block]);
  });

  it("persists a mystery visit for resume", () => {
    setRunSession({
      mysteryEvent: {
        id: "ancient-altar",
        title: "Ancient Altar",
        art: "",
        narrative: "A weathered stone altar.",
        choices: [{ label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] }],
      },
      mysteryChosenChoice: { label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] },
      mysteryCardChoices: null,
      mysteryGrantedTrinketIds: [],
      mysteryGrantedGearInstances: [],
      mysteryChosenCardId: null,
    });

    const result = encodeState("mystery");
    const decoded = decodeRunResumeSnapshot(result);

    expect(result.mysteryVisit).toEqual(ANCIENT_ALTAR_MYSTERY_VISIT);
    expect(decoded.session.mysteryEvent?.id).toBe("ancient-altar");
    expect(decoded.session.mysteryChosenChoice?.label).toBe("Take the Offering");
  });

  it("does not persist leftover mystery visit state off the mystery screen", () => {
    setRunSession({
      mysteryEvent: {
        id: "ancient-altar",
        title: "Ancient Altar",
        art: "",
        narrative: "A weathered stone altar.",
        choices: [{ label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] }],
      },
      mysteryChosenChoice: ANCIENT_ALTAR_MYSTERY_VISIT.chosenChoice,
    });

    const result = encodeState("destination");
    const decoded = decodeRunResumeSnapshot(result);

    expect(result.mysteryVisit).toBeNull();
    expect(decoded.session.mysteryEvent).toBeNull();
    expect(decoded.session.mysteryChosenChoice).toBeNull();
  });

  it("persists a corruption result for resume", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    const corruptionResult = {
      originalCard: slash,
      corruptedCard: { ...slash, corrupted: true },
      transformed: false as const,
      delta: -1 as const,
    };
    setRunSession({ corruptionResult });

    const result = encodeState("corruption");

    expect(result.corruptionResult).toEqual(corruptionResult);
    expect(decodeRunResumeSnapshot(result).session.corruptionResult).toEqual(corruptionResult);
  });

  it("does not persist leftover corruption result off the corruption screen", () => {
    const [slash] = getStartingDeck("knight");
    if (!slash) throw new Error("Knight starting deck fixture is incomplete");
    const corruptionResult = {
      originalCard: slash,
      corruptedCard: { ...slash, corrupted: true },
      transformed: false as const,
      delta: -1 as const,
    };
    setRunSession({ corruptionResult });

    const result = encodeState("destination");
    const decoded = decodeRunResumeSnapshot(result);

    expect(result.corruptionResult).toBeNull();
    expect(decoded.session.corruptionResult).toBeNull();
  });
});
