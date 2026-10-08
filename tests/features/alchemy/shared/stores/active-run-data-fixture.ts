import { savedActivityFixture } from "../../../../fixtures/run-activity";
import { defaultBattleState } from "@/lib/battle";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-state";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { getStartingDeck } from "@/lib/game-data";
import { findMysteryEvent } from "@/lib/mystery";
import type { ActiveRunData, PersistedMysteryVisit } from "@/lib/active-run-session";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import { createRunRngState, createSeededRng } from "@/lib/rng";

export const ANCIENT_ALTAR_MYSTERY_VISIT: PersistedMysteryVisit = {
  event: findMysteryEvent("ancient-altar")!,
  chosenChoice: { label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] },
  cardChoices: null,
  grantedTrinketIds: [],
  grantedGear: [],
  chosenCardId: null,
};

export function makeActiveRunData(overrides: Partial<ActiveRunData> = {}): ActiveRunData {
  return {
    characterId: "knight",
    runDeck: [],
    runPlayerHealth: 20,
    runMaxHealth: 30,
    runMetaMaxHealth: 30,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    lastOfferedDestinations: [],
    destinationRoundsSinceOffered: {},
    runBoons: [],
    encounteredRunEnemyIds: [],
    selectedDifficulty: null,
    contentSystemType: "campaign",
    rng: createRunRngState(() => 0.5),
    labyrinthMap: null,
    labyrinthPendingNode: null,
    activeLabyrinthModifiers: [],
    activeLabyrinthRewardModifiers: [],
    wildwoodDraft: null,
    starterDraftChoices: null,
    runTalentXP: {},
    runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 },
    runCurrenciesEarned: { ...EMPTY_CRAFTING_CURRENCIES },
    runObtainedItems: [],
    runHistory: [],
    runHistoryPartial: false,
    runGoldEarned: 0,
    activity: savedActivityFixture("destination"),
    ...overrides,
  } satisfies ActiveRunData;
}

export function createCompleteActiveRunData(): ActiveRunData {
  const [slash, block] = getStartingDeck("knight");
  if (!slash || !block) throw new Error("Knight starting deck fixture is incomplete");

  const battleState = {
    ...defaultBattleState(),
    turn: 4,
    playerHealth: 19,
    turnPhase: "player" as const,
    hand: [],
  };

  const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
  const labyrinthPendingNode =
    Object.values(labyrinthMap.nodes).find((node) => canEnterLabyrinthNode(labyrinthMap, node.id))?.id ?? null;

  return {
    characterId: "knight",
    runDeck: [slash, block],
    runHistory: [{ id: "labyrinth:1:sample", destination: "Campfire", act: 2, floor: 1, completed: true }],
    runHistoryPartial: false,
    runGoldEarned: 42,
    runPlayerHealth: 19,
    runMaxHealth: 34,
    runMetaMaxHealth: 34,
    roomsEncountered: 8,
    currentAct: 2,
    destinationIndexInAct: 3,
    completedDestinations: ["Normal Combat", "Campfire"],
    lastOfferedDestinations: ["Mystery", "Card Shop"],
    destinationRoundsSinceOffered: { Mystery: 2, Campfire: 1 },
    runBoons: ["bone-charm"],
    encounteredRunEnemyIds: ["goblin"],
    selectedDifficulty: "difficulty-2",
    contentSystemType: "labyrinth",
    rng: createRunRngState(() => 123 / 0x1_0000_0000),
    labyrinthMap,
    labyrinthPendingNode,
    activeLabyrinthModifiers: ["tempered"],
    activeLabyrinthRewardModifiers: ["generous"],
    wildwoodDraft: null,
    starterDraftChoices: null,
    runTalentXP: { armor: 11, burn: 7 },
    runMaterialsEarned: { wood: 2, iron: 3, herbs: 4, food: 5, gems: 6, stone: 0, hide: 0 },
    runCurrenciesEarned: { ...EMPTY_CRAFTING_CURRENCIES, "discordant-dice": 2 },
    runObtainedItems: [
      { kind: "gear", instance: { instanceId: "resume-obtained-gear", definitionId: "ruby-ring-basic", affixes: [] } },
      { kind: "trinket", trinketId: "bone-charm" },
    ],
    activity: savedActivityFixture("battle", {
      battleState,

      activeLabyrinthModifiers: ["tempered"],
      activeLabyrinthRewardModifiers: ["generous"],
    }),
  } satisfies ActiveRunData;
}
