import { defaultBattleState } from "@/lib/battle";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { getStartingDeck } from "@/lib/game-data";
import type { ActiveRunData, PersistedMysteryVisit } from "@/lib/active-run-session";
import { createRunRngState } from "@/lib/run-rng";
import { createSeededRng } from "@/lib/utils";

export const ANCIENT_ALTAR_MYSTERY_VISIT: PersistedMysteryVisit = {
  eventId: "ancient-altar",
  chosenChoice: { label: "Take the Offering", effects: [{ kind: "gainXP", keyword: "holy", amount: 8 }] },
  pendingRemoval: false,
  cardChoices: null,
  grantedTrinketIds: [],
  grantedGear: [],
  chosenCardId: null,
  resolvedTrinketIds: [],
};

export function makeActiveRunData(overrides: Partial<ActiveRunData> = {}): ActiveRunData {
  return {
    characterId: "knight",
    runDeck: [],
    runGold: 0,
    runPlayerHealth: 20,
    runMaxHealth: 30,
    runMetaMaxHealth: 30,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    lastOfferedDestinations: [],
    destinationRoundsSinceOffered: {},
    runTrinkets: [],
    encounteredRunEnemyIds: [],
    selectedDifficulty: null,
    contentSystemType: "campaign",
    rng: createRunRngState(() => 0.5),
    labyrinthMap: null,
    labyrinthPendingNode: null,
    wildwoodDraft: null,
    starterDraftChoices: null,
    activeCombat: null,
    runTalentXP: {},
    runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    currentScreen: null,
    interruptedFlow: { kind: "none" },
    shopState: null,
    alchemistState: null,
    trinketShopState: null,
    equipmentShopState: null,
    mysteryVisit: null,
    corruptionResult: null,
    ...overrides,
  } satisfies ActiveRunData;
}

/**
 * Complete, non-default active-run fixture. `satisfies` makes persistence field
 * additions fail typecheck until this fixture and its round-trip assertions move
 * with the contract.
 */
export function createCompleteActiveRunData(): ActiveRunData {
  const [slash, block] = getStartingDeck("knight");
  if (!slash || !block) throw new Error("Knight starting deck fixture is incomplete");

  const battleState = {
    ...defaultBattleState(),
    turn: 4,
    playerHealth: 19,
    turnPhase: "enemy" as const,
    hand: [],
  };

  return {
    characterId: "knight",
    runDeck: [slash, block],
    runGold: 87,
    runPlayerHealth: 19,
    runMaxHealth: 34,
    runMetaMaxHealth: 34,
    roomsEncountered: 8,
    currentAct: 2,
    destinationIndexInAct: 3,
    completedDestinations: ["Normal Combat", "Campfire"],
    lastOfferedDestinations: ["Mystery", "Merchant's Shop"],
    destinationRoundsSinceOffered: { Mystery: 2, Campfire: 1 },
    runTrinkets: ["bone-charm"],
    encounteredRunEnemyIds: ["goblin"],
    selectedDifficulty: "difficulty-2",
    contentSystemType: "labyrinth",
    rng: createRunRngState(() => 123 / 0x1_0000_0000),
    labyrinthMap: generateLabyrinthMap(createSeededRng(42)),
    labyrinthPendingNode: { row: 1, col: 1 },
    wildwoodDraft: null,
    starterDraftChoices: null,
    activeCombat: {
      battleState,
      pendingBattleTransition: { kind: "continue-end-turn" },
      activeLabyrinthModifiers: ["tempered"],
      activeLabyrinthRewardModifiers: ["generous"],
    },
    runTalentXP: { armor: 11, burn: 7 },
    runMaterialsEarned: { wood: 2, iron: 3, herbs: 4, food: 5, crystal: 6 },
    currentScreen: "destination",
    interruptedFlow: {
      kind: "destination",
      destinations: ["Mystery", "Merchant's Shop"],
      selectedBossId: null,
      lastVictoryEnemyType: "elite",
      lastVictoryContentSystem: "labyrinth",
    },
    shopState: {
      cards: [slash],
      removeUsed: true,
      refreshesLeft: 1,
      firstPurchaseUsed: true,
      purchasedSlotKeys: ["card:0"],
    },
    alchemistState: {
      potions: [block],
      mixUsed: true,
      refreshesLeft: 2,
      firstPurchaseUsed: true,
      purchasedSlotKeys: ["potion:0"],
    },
    trinketShopState: {
      trinketIds: ["bone-charm"],
      refreshesLeft: 1,
      firstPurchaseUsed: true,
      purchasedSlotKeys: ["trinket:0"],
    },
    equipmentShopState: {
      gear: [{ instanceId: "resume-gear", definitionId: "ruby-ring-basic", affixes: [] }],
      refreshesLeft: 1,
      firstPurchaseUsed: true,
      purchasedSlotKeys: ["gear:0"],
    },
    mysteryVisit: null,
    corruptionResult: null,
  } satisfies ActiveRunData;
}
