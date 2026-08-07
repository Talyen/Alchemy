// Current-schema save payloads for migration guard and storage tests.
// CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION maps the launch baseline to a fixture.
// Depends on deterministic labyrinth map generation so fixture tests can cover mid-run map saves.
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import {
  CURRENT_CONTENT_VERSION,
  CURRENT_GAME_BUILD_VERSION,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation/metadata";

const FIXTURE_CHARACTER_IDS = [
  "knight",
  "rogue",
  "wizard",
  "ranger",
  "alchemist",
  "warlock",
  "druid",
  "wildcard",
] as const;
const FIXTURE_GEAR_SLOTS = [
  "body",
  "helm",
  "boots",
  "gloves",
  "belt",
  "main-hand",
  "off-hand",
  "left-ring",
  "right-ring",
  "amulet",
] as const;

function emptyGearInventories() {
  return Object.fromEntries(FIXTURE_CHARACTER_IDS.map((id) => [id, [] as unknown[]])) as Record<string, unknown[]>;
}

function emptyGearLoadouts() {
  return Object.fromEntries(
    FIXTURE_CHARACTER_IDS.map((id) => [id, Object.fromEntries(FIXTURE_GEAR_SLOTS.map((slot) => [slot, null]))]),
  ) as Record<string, Record<string, string | null>>;
}

function emptyBoardPositionsByCharacter() {
  return Object.fromEntries(FIXTURE_CHARACTER_IDS.map((id) => [id, {}])) as Record<string, object>;
}

function emptyCraftingCurrencies() {
  return {
    "discordant-dice": 0,
    "sprig-of-growth": 0,
    voidstone: 0,
    "ascension-seal": 0,
    "severance-maw": 0,
    "smiths-whetstone": 0,
  };
}

function currentSaveEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    selectedAspectRatio: "auto",
    displayMode: "borderless-fullscreen",
    brightness: 100,
    discoveredCardIds: [] as string[],
    encounteredEnemyIds: [] as string[],
    discoveredTrinketIds: [] as string[],
    gearInventories: emptyGearInventories(),
    gearLoadouts: emptyGearLoadouts(),
    gearBoardPositionsByCharacter: emptyBoardPositionsByCharacter(),
    craftingCurrencies: emptyCraftingCurrencies(),
    craftingCurrencyBoardPositionsByCharacter: emptyBoardPositionsByCharacter(),
    talentXP: {} as Record<string, number>,
    unlockedTalents: {} as Record<string, string[]>,
    musicVolume: 50,
    sfxVolume: 50,
    masterVolume: 50,
    muteInBackground: true,
    autoEndTurn: true,
    activeRun: null,
    materialInventory: {},
    constructedBuildings: {},
    plantedFarms: {},
    completedResearch: {},
    bondedCompanions: {},
    completedDifficulties: {
      knight: [],
      rogue: [],
      wizard: [],
      ranger: [],
      alchemist: [],
      warlock: [],
      druid: [],
      wildcard: [],
    },
    finishedRunCharacters: [] as string[],
    lastSavedAt: 0,
    ...overrides,
  };
}

/** Full meta-progress v10 save with gear, talents, and a mid-campaign active run. */
function currentSchemaSave() {
  return currentSaveEnvelope({
    discoveredCardIds: ["slash", "block"],
    encounteredEnemyIds: ["goblin"],
    discoveredTrinketIds: ["bone-charm"],
    gearInventories: (() => {
      const inventories = emptyGearInventories();
      inventories.knight = [
        {
          instanceId: "gear-1",
          definitionId: "leather-armor-basic",
          affixes: [{ id: "flat-physical", value: 1 }],
        },
      ];
      return inventories;
    })(),
    gearLoadouts: (() => {
      const loadouts = emptyGearLoadouts();
      loadouts.knight.body = "gear-1";
      return loadouts;
    })(),
    talentXP: { physical: 10, wish: 4 },
    unlockedTalents: { physical: ["physical-dmg-1"], wish: ["wish-trinket"] },
    finishedRunCharacters: ["knight"],
    activeRun: {
      characterId: "knight",
      runDeck: [
        {
          id: "slash",
          title: "Slash",
          descriptionLines: ["Deal 6 Physical damage"],
          art: "slash.webp",
          cost: 1,
          effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
        },
      ],
      runGold: 55,
      runPlayerHealth: 22,
      runMaxHealth: 30,
      roomsEncountered: 4,
      currentAct: 1,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
      runTrinkets: ["bone-charm"],
      selectedDifficulty: "difficulty-1",
      contentSystemType: "campaign",
      currentScreen: "destination",
    },
    materialInventory: { wood: 5, iron: 3 },
    completedDifficulties: { knight: ["difficulty-1"] },
  });
}

// Campaign fixture with a mid-run active campaign at the current schema.
export function currentSchemaCampaignSave() {
  return currentSaveEnvelope({
    selectedAspectRatio: "auto",
    displayMode: "fullscreen",
    discoveredCardIds: ["slash", "block", "bash"],
    encounteredEnemyIds: ["goblin"],
    discoveredTrinketIds: ["bone-charm"],
    talentXP: { physical: 18, block: 7 },
    unlockedTalents: { physical: ["physical-dmg-1"] },
    musicVolume: 40,
    sfxVolume: 80,
    masterVolume: 90,
    muteInBackground: false,
    autoEndTurn: true,
    brightness: 110,
    activeRun: {
      characterId: "knight",
      runDeck: [
        {
          id: "slash",
          title: "Slash",
          descriptionLines: ["Deal 6 Physical damage"],
          art: "old-slash.webp",
          cost: 1,
          effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
        },
      ],
      runGold: 42,
      runPlayerHealth: 18,
      runMaxHealth: 30,
      roomsEncountered: 3,
      currentAct: 1,
      destinationIndexInAct: 2,
      completedDestinations: ["Normal Combat", "Campfire"],
      runTrinkets: ["bone-charm"],
      selectedDifficulty: "difficulty-1",
      contentSystemType: "campaign",
    },
    materialInventory: { wood: 4, iron: 2 },
    constructedBuildings: { "blacksmiths-forge": 1 },
    plantedFarms: { pasture: 1 },
    completedResearch: { "leyline-energy": 1 },
    bondedCompanions: { wolf: 1 },
    completedDifficulties: { knight: ["difficulty-1"] },
  });
}

// Labyrinth fixture exercises persisted map hydration for a route in progress.
export function currentSchemaLabyrinthRunSave() {
  const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
  return currentSaveEnvelope({
    discoveredCardIds: ["slash", "bash"],
    activeRun: {
      characterId: "ranger",
      runDeck: [],
      runGold: 12,
      runPlayerHealth: 24,
      runMaxHealth: 30,
      roomsEncountered: 1,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      contentSystemType: "labyrinth",
      labyrinthMap,
    },
  });
}

// Corrupted-card fixture preserves intentional card mutations while refreshing library-owned fields.
export function currentSchemaCorruptedCardRunSave() {
  return currentSaveEnvelope({
    activeRun: {
      characterId: "wizard",
      runDeck: [
        {
          id: "fireball",
          title: "Old Fireball Title",
          descriptionLines: ["Deal 9 Burn damage"],
          art: "old-fireball.webp",
          cost: 2,
          effects: [{ kind: "damage", damageType: "burn", amount: 9 }],
          corrupted: true,
          baseTitle: "Fireball",
          corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }],
        },
      ],
      runGold: 5,
      runPlayerHealth: 20,
      runMaxHealth: 30,
      roomsEncountered: 2,
      currentAct: 1,
      destinationIndexInAct: 1,
      completedDestinations: ["Mystery"],
      runTrinkets: [],
      selectedDifficulty: "difficulty-1",
      contentSystemType: "campaign",
    },
  });
}

/** Wildwood reward phase with trinket choices at the current schema. */
function currentSchemaWildwoodTrinketRewardSave() {
  return currentSaveEnvelope({
    finishedRunCharacters: ["knight", "ranger"],
    activeRun: {
      characterId: "ranger",
      runDeck: [],
      runGold: 30,
      runPlayerHealth: 28,
      runMaxHealth: 30,
      roomsEncountered: 2,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: null,
      contentSystemType: "wildwood",
      wildwoodDraft: {
        version: 3,
        phase: "reward",
        draftChoices: [],
        remainingBossIds: ["iron-bear"],
        previousBossId: "forge-golem",
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: ["collector"],
        rewardType: "trinket",
        rewardChoiceIds: ["bone-charm", "brass-censer"],
        rewardGearChoices: [],
        selectedRewardId: null,
      },
    },
  });
}

/** Mid-combat snapshot with trinket effects and combat flags at the current schema. */
export function currentSchemaMidCombatTrinketSave() {
  return currentSaveEnvelope({
    discoveredTrinketIds: ["bone-charm", "meteorite"],
    finishedRunCharacters: ["knight"],
    activeRun: {
      characterId: "knight",
      runDeck: [],
      runGold: 10,
      runPlayerHealth: 20,
      runMaxHealth: 30,
      roomsEncountered: 2,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: ["meteorite", "bone-charm"],
      discoveredTrinketIdsAtRunStart: ["bone-charm"],
      selectedDifficulty: "difficulty-1",
      contentSystemType: "campaign",
      activeCombat: {
        battleState: {
          deck: [],
          hand: [],
          discard: [],
          exhausted: [],
          mana: 2,
          maxMana: 3,
          gold: 10,
          turn: 2,
          turnPhase: "player",
          playerHealth: 20,
          playerMaxHealth: 30,
          enemyHealth: 25,
          enemyMaxHealth: 30,
          currentEnemy: {
            id: "goblin",
            title: "Goblin",
            subtitle: "",
            descriptionLines: [],
            art: "",
            enemyType: "normal",
            traits: [],
            attackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
          },
          enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
          playerStatuses: {},
          enemyStatuses: {},
          flags: { firstBurnTrinketDoubledUsed: true },
          discoveredCardIds: [],
          difficultyModifiers: [],
          trinketEffects: { firstBurnDoubled: true, boneCharmHealOnKill: 3 },
        },
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    },
  });
}

export const CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION: Record<number, () => Record<string, unknown>> = {
  10: currentSchemaSave,
};

export const MIGRATION_SCENARIO_FIXTURES: Record<string, () => Record<string, unknown>> = {
  midCombatTrinket: currentSchemaMidCombatTrinketSave,
  wildwoodTrinketReward: currentSchemaWildwoodTrinketRewardSave,
  shippedBaseline: currentSchemaSave,
};
