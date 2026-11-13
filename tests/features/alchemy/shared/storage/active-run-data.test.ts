import { savedActivityFixture, savedActivityData } from "../../../../fixtures/run-activity";
import {
  mutateGameplayForTest,
  getBattleForTest,
  setBattleActiveForTest,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { battleSnapshot } from "@/lib/battle";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { getStartingDeck, trinketLibrary } from "@/lib/game-data";
import {
  emptyHydratedMysteryVisit,
  emptyShopState,
  emptyAlchemistState,
  emptyTrinketShopState,
  emptyEquipmentShopState,
  readActivityData,
  type RunActivity,
  type ActiveRunData,
} from "@/lib/active-run-session";
import {
  decodeRunResumeSnapshot,
  encodeRunResumeSnapshot,
} from "@/features/alchemy/shared/stores/persistence/run-resume-codec";
import { createInitialActiveRunFields } from "@/features/alchemy/shared/stores/session/run-state-init";
import { readActiveRun, readBattle, readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import { setDestinationState } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { ANCIENT_ALTAR_MYSTERY_VISIT, makeActiveRunData } from "../stores/session/active-run-data-fixture";
import { defaultGameSession } from "@/app/application-session";
function encodeState(): ActiveRunData {
  return encodeRunResumeSnapshot({
    run: readActiveRun(defaultGameSession),
    session: readRunSession(defaultGameSession),
  });
}

function writeBattle(partial: { hasActiveBattle?: boolean; battleState?: BattleState }) {
  mutateGameplayForTest((draft) => {
    if (partial.hasActiveBattle !== undefined) setBattleActiveForTest(draft, partial.hasActiveBattle);
    if (partial.battleState !== undefined) getBattleForTest(draft).battleState = battleSnapshot(partial.battleState);
  });
}

beforeEach(() => {
  resetRunDomainStore();
  setRunSession({ hasActiveRun: true, activity: { kind: "destination" } });
});

describe("encodeRunResumeSnapshot", () => {
  it("copies only persisted active-run fields", () => {
    const runDeck = getStartingDeck("knight");
    setRunProgress({
      characterId: "knight",
      runDeck,
      runPlayerHealth: 18,
      runMaxHealth: 32,
      roomsEncountered: 4,
      currentAct: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat", "Campfire"],
      lastOfferedDestinations: ["Mystery", "Campfire", "Card Shop"],
      destinationRoundsSinceOffered: { Mystery: 2 },
      runBoons: ["bone-charm"],
      encounteredRunEnemyIds: ["goblin"],
      runTalentXP: {},
      runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 },
      runObtainedItems: [],
    });

    const result = encodeState();

    expect(result).toEqual(
      makeActiveRunData({
        runDeck,
        runPlayerHealth: 18,
        runMaxHealth: 32,
        runMetaMaxHealth: readActiveRun(defaultGameSession).runMetaMaxHealth,
        roomsEncountered: 4,
        currentAct: 2,
        destinationIndexInAct: 1,
        completedDestinations: ["Normal Combat", "Campfire"],
        lastOfferedDestinations: ["Mystery", "Campfire", "Card Shop"],
        destinationRoundsSinceOffered: { Mystery: 2 },
        runBoons: ["bone-charm"],
        encounteredRunEnemyIds: ["goblin"],
        rng: readActiveRun(defaultGameSession).rng,
      }),
    );
  });

  it("drops shop offerings once the player leaves the shop activity", () => {
    const card = getStartingDeck("knight")[0]!;
    setRunSession({
      activity: {
        kind: "shop",
        data: {
          ...readActivityData(readRunSession(defaultGameSession).activity, "shop"),
          cards: [card],
        },
      },
    });

    expect(savedActivityData(encodeState(), "shop")?.cards).toHaveLength(1);
    setRunSession({ activity: { kind: "destination" } });
    expect(savedActivityData(encodeState(), "shop")).toBeNull();
  });

  it.each([
    ["shop", () => ({ kind: "shop", data: { ...emptyShopState(), cards: [getStartingDeck("knight")[0]!] } })],
    [
      "alchemist",
      () => ({ kind: "alchemist", data: { ...emptyAlchemistState(), potions: [getStartingDeck("knight")[0]!] } }),
    ],
    [
      "trinket-shop",
      () => ({ kind: "trinket-shop", data: { ...emptyTrinketShopState(), trinkets: [trinketLibrary[0]!] } }),
    ],
    [
      "equipment-shop",
      () => ({
        kind: "equipment-shop",
        data: {
          ...emptyEquipmentShopState(),
          gear: [{ instanceId: "shelf-1", definitionId: "leather-armor-basic", affixes: [] }],
        },
      }),
    ],
  ] satisfies Array<[string, () => RunActivity]>)("keeps only %s offerings", (screen, activity) => {
    const visit = activity();
    setRunSession({ activity: visit });
    const encoded = encodeState();
    expect(encoded.activity).toMatchObject({
      kind: screen,
      data:
        visit.kind === "trinket-shop" ? { trinketIds: visit.data.trinkets.map((trinket) => trinket.id) } : visit.data,
    });
    for (const other of ["shop", "alchemist", "trinket-shop", "equipment-shop"] as const) {
      if (other !== screen) expect(savedActivityData(encoded, other)).toBeNull();
    }
  });

  it("persists active campaign combat while leaving measurements in the live battle", () => {
    const battleState = { ...defaultBattleState(), turn: 3, playerHealth: 12 };
    const measurements = { enemyAttackActions: 2, enemyAbilityActivations: { "iron-hide": 1 } };
    writeBattle({ hasActiveBattle: true, battleState: { ...battleState, battleMetrics: measurements } });

    const result = encodeState();

    expect(savedActivityData(result, "battle")?.battleState).toEqual(battleSnapshot(battleState));
    expect(readBattle(defaultGameSession).battleState.battleMetrics).toEqual(measurements);
  });

  it("persists the current state during enemy phase instead of reverting to battle start", () => {
    const enemyPhaseState = { ...defaultBattleState(), turn: 2, turnPhase: "enemy" as const, hand: [] };
    writeBattle({ hasActiveBattle: true, battleState: enemyPhaseState });

    const result = encodeState();

    expect(savedActivityData(result, "battle")?.battleState).toEqual(battleSnapshot(enemyPhaseState));
    expect(savedActivityData(result, "battle")!.battleState.turn).toBe(2);
    expect(savedActivityData(result, "battle")!.battleState.turnPhase).toBe("enemy");
  });

  it("preserves enemy-phase battle state when no pending transition exists", () => {
    writeBattle({
      hasActiveBattle: true,
      battleState: { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] },
    });

    const activeRun = encodeState();
    expect(decodeRunResumeSnapshot(activeRun).session.activity.kind).toBe("battle");

    expect(savedActivityData(activeRun, "battle")?.battleState.turnPhase).toBe("enemy");
  });

  it("persists labyrinth pending node and modifiers during combat", () => {
    setRunProgress({ contentSystemType: "labyrinth" });
    setRunSession({
      activeLabyrinthPendingNode: "labyrinth-floor-1-n0",
      activeLabyrinthModifiers: ["tempered"],
      activeLabyrinthRewardModifiers: ["generous"],
    });
    writeBattle({ hasActiveBattle: true });

    const result = encodeState();

    expect(result.labyrinthPendingNode).toBe("labyrinth-floor-1-n0");
    expect(result.activeLabyrinthModifiers).toEqual(["tempered"]);
    expect(result.activeLabyrinthRewardModifiers).toEqual(["generous"]);
  });

  it.each([
    { ending: "victory", battle: { turn: 5, enemyHealth: 0 } },
    {
      ending: "defeat",
      battle: { turn: 3, playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: false },
    },
  ])("preserves an active terminal battle until $ending settles", ({ battle }) => {
    writeBattle({ hasActiveBattle: true, battleState: { ...defaultBattleState(), ...battle } });
    expect(savedActivityData(encodeState(), "battle")?.battleState).toBeDefined();
  });

  it("persists runTalentXP", () => {
    const runTalentXP = { burn: 10, poison: 5 };
    setRunProgress({ runTalentXP });

    const result = encodeState();

    expect(result.runTalentXP).toEqual(runTalentXP);
  });

  it("drops retired shop names when hydrating destination history", () => {
    const fields = createInitialActiveRunFields(
      makeActiveRunData({
        lastOfferedDestinations: ["Merchant's Shop"],
        completedDestinations: ["Equipment Shop"],
        destinationRoundsSinceOffered: { "Merchant's Shop": 2 },
      }),
    );

    expect(fields.lastOfferedDestinations).toEqual([]);
    expect(fields.completedDestinations).toEqual([]);
    expect(fields.destinationRoundsSinceOffered).toEqual({});
  });

  it("persists destination resume fields", () => {
    mutateGameplayForTest((draft) =>
      setDestinationState(draft, (prev) => ({ ...prev, destinations: ["Campfire", "Card Shop"] })),
    );

    const result = encodeState();

    expect(result.activity.kind).toBe("destination");
    expect(result.activity).toEqual(
      savedActivityFixture("destination", {
        destinations: ["Campfire", "Card Shop"],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      }),
    );
  });

  it("persists Wildwood Draft phase state", () => {
    const wildwoodDraft = {
      phase: "reward" as const,
      draftChoices: [],
      remainingBossIds: ["iron-bear"] as Array<"forge-golem" | "frostwarden" | "blight-treant" | "iron-bear">,
      previousBossId: "forge-golem" as const,
      currentBossId: "frostwarden" as const,
      currentCombatTraitIds: ["tempered" as const],
      currentRewardTraitIds: ["alchemist" as const],
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

    const result = encodeState();
    const decoded = decodeRunResumeSnapshot(result);

    expect(result.starterDraftChoices).toEqual([slash, block]);
    expect(decoded.session.starterDraftChoices).toEqual([slash, block]);
  });

  describe.each(["mystery", "corruption"] as const)("%s visit persistence", (kind) => {
    function visit(): RunActivity {
      if (kind === "mystery") {
        const choice = {
          label: "Take the Offering",
          effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }],
        } as const;
        return {
          kind,
          data: {
            ...emptyHydratedMysteryVisit(),
            mysteryEvent: {
              id: "ancient-altar",
              title: "Ancient Altar",
              art: "",
              narrative: "A weathered stone altar.",
              choices: [{ ...choice, effects: [...choice.effects] }],
            },
            mysteryChosenChoice: { ...choice, effects: [...choice.effects] },
          },
        };
      }
      const slash = getStartingDeck("knight")[0]!;
      return {
        kind,
        data: { originalCard: slash, corruptedCard: { ...slash, corrupted: true }, transformed: false, delta: -1 },
      };
    }

    it("persists the current result for resume", () => {
      const activity = visit();
      setRunSession({ activity });
      const result = encodeState();
      const decoded = decodeRunResumeSnapshot(result);
      if (activity.kind === "mystery") {
        const offered = activity.data.mysteryEvent;
        expect(savedActivityData(result, "mystery")?.event).toEqual(offered);
        expect(readActivityData(decoded.session.activity, "mystery").mysteryEvent).toEqual(offered);
        expect(readActivityData(decoded.session.activity, "mystery").mysteryChosenChoice?.label).toBe(
          "Take the Offering",
        );
      } else if (activity.kind === "corruption") {
        expect(savedActivityData(result, "corruption")).toEqual(activity.data);
        expect(readActivityData(decoded.session.activity, "corruption")).toEqual(activity.data);
      }
    });

    it("drops a completed result after entering another activity", () => {
      const activity = visit();
      if (activity.kind === "mystery") activity.data.mysteryChosenChoice = ANCIENT_ALTAR_MYSTERY_VISIT.chosenChoice;
      setRunSession({ activity });
      setRunSession({ activity: { kind: "destination" } });
      const result = encodeState();
      const decoded = decodeRunResumeSnapshot(result);
      expect(savedActivityData(result, kind)).toBeNull();
      if (kind === "mystery") {
        expect(readActivityData(decoded.session.activity, kind).mysteryEvent).toBeNull();
        expect(readActivityData(decoded.session.activity, kind).mysteryChosenChoice).toBeNull();
      } else expect(readActivityData(decoded.session.activity, kind)).toBeNull();
    });
  });
});
