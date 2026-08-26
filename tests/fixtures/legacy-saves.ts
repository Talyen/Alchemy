// Current-schema save payloads for migration guard and storage tests.
// CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION maps the launch baseline to a fixture.
// Labyrinth maps here are seeded so mid-run map-save fixtures stay deterministic.
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { saveEnvelopeFixture } from "./saves";

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
const FIXTURE_GEAR_SLOTS = ["main-hand", "off-hand", "body", "left-ring", "right-ring", "amulet"] as const;

function emptyGearInventories() {
  return Object.fromEntries(FIXTURE_CHARACTER_IDS.map((id) => [id, [] as unknown[]])) as Record<string, unknown[]>;
}

function emptyGearLoadouts() {
  return Object.fromEntries(
    FIXTURE_CHARACTER_IDS.map((id) => [id, Object.fromEntries(FIXTURE_GEAR_SLOTS.map((slot) => [slot, null]))]),
  ) as Record<string, Record<string, string | null>>;
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

/** Current-schema envelope: shared core plus the gear/crafting fields migration guards rely on. */
function currentSaveEnvelope(overrides: Record<string, unknown> = {}) {
  return saveEnvelopeFixture({
    saveSchemaVersion: 11,
    discoveredCardIds: [] as string[],
    encounteredEnemyIds: [] as string[],
    discoveredTrinketIds: [] as string[],
    gearInventories: emptyGearInventories(),
    gearLoadouts: emptyGearLoadouts(),
    craftingCurrencies: emptyCraftingCurrencies(),
    talentXP: {} as Record<string, number>,
    unlockedTalents: {} as Record<string, string[]>,
    materialInventory: {},
    constructedBuildings: {},
    plantedFarms: {},
    completedResearch: {},
    bondedCompanions: {},
    finishedRunCharacters: [] as string[],
    ...overrides,
  });
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
function nestedWildwoodDraft(overrides: Record<string, unknown> = {}) {
  return {
    version: 3,
    phase: "reward",
    draftChoices: [],
    remainingBossIds: ["iron-bear"],
    previousBossId: "forge-golem",
    currentBossId: null,
    currentCombatTraitIds: [],
    currentRewardTraitIds: ["alchemist"],
    rewardType: "boon",
    rewardChoiceIds: ["meteorite"],
    rewardGearChoices: [],
    selectedRewardId: null,
    ...overrides,
  };
}

function wildwoodRun(overrides: Record<string, unknown> = {}) {
  return {
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
    currentScreen: "rewards",
    interruptedFlow: { kind: "none" },
    wildwoodDraft: nestedWildwoodDraft(),
    ...overrides,
  };
}

function currentSchemaWildwoodTrinketRewardSave() {
  return {
    ...currentSaveEnvelope({
      finishedRunCharacters: ["knight", "ranger"],
      activeRun: wildwoodRun({
        wildwoodDraft: nestedWildwoodDraft({
          currentRewardTraitIds: ["collector"],
          rewardType: "trinket",
          rewardChoiceIds: ["bone-charm", "brass-censer"],
        }),
      }),
    }),
    saveSchemaVersion: 12,
  };
}

function currentSchemaV12Save() {
  return {
    ...currentSchemaSave(),
    saveSchemaVersion: 12,
  };
}

function currentSchemaWildwoodCardRewardSave() {
  return {
    ...currentSaveEnvelope({
      finishedRunCharacters: ["knight"],
      activeRun: wildwoodRun({
        wildwoodDraft: nestedWildwoodDraft({
          rewardType: "card",
          rewardChoiceIds: ["slash", "block"],
        }),
      }),
    }),
    saveSchemaVersion: 12,
  };
}

function currentSchemaWildwoodGearRewardSave() {
  return {
    ...currentSaveEnvelope({
      finishedRunCharacters: ["knight"],
      activeRun: wildwoodRun({
        wildwoodDraft: nestedWildwoodDraft({
          rewardType: "gear",
          rewardChoiceIds: [],
          rewardGearChoices: [{ instanceId: "gear-1", definitionId: "ruby-ring-basic", affixes: [] }],
        }),
      }),
    }),
    saveSchemaVersion: 12,
  };
}

function currentSchemaWildwoodSelectedRewardSave() {
  return {
    ...currentSaveEnvelope({
      finishedRunCharacters: ["knight"],
      activeRun: wildwoodRun({
        wildwoodDraft: nestedWildwoodDraft({
          rewardType: "card",
          rewardChoiceIds: ["slash", "block"],
          selectedRewardId: "slash",
        }),
      }),
    }),
    saveSchemaVersion: 12,
  };
}

function currentSchemaWildwoodCompanionHandoffSave() {
  return {
    ...currentSaveEnvelope({
      finishedRunCharacters: ["knight"],
      activeRun: wildwoodRun({
        interruptedFlow: {
          kind: "companion-reward",
          pending: {
            rewardType: "card",
            choiceIds: [],
            companionChoiceIds: ["wolf-companion"],
            selectedId: null,
            gold: 0,
            materials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
            destinations: [],
            selectedBossId: null,
            lastVictoryEnemyType: "boss",
            lastVictoryContentSystem: "wildwood",
          },
        },
        wildwoodDraft: nestedWildwoodDraft({
          rewardType: "card",
          rewardChoiceIds: ["slash"],
        }),
      }),
    }),
    saveSchemaVersion: 12,
  };
}

function currentSchemaParkedWildwoodNestedRewardSave() {
  return {
    ...currentSaveEnvelope({
      finishedRunCharacters: ["knight"],
      parkedRuns: {
        wildwood: wildwoodRun({
          wildwoodDraft: nestedWildwoodDraft({
            rewardType: "card",
            rewardChoiceIds: ["slash", "bash"],
          }),
        }),
      },
    }),
    saveSchemaVersion: 12,
  };
}

function currentSchemaParkedWildwoodDraftSave() {
  return {
    ...currentSaveEnvelope({
      finishedRunCharacters: ["knight"],
      parkedRuns: {
        wildwood: wildwoodRun({
          currentScreen: "draft-deck",
          interruptedFlow: { kind: "none" },
          wildwoodDraft: nestedWildwoodDraft({
            phase: "draft",
            rewardType: null,
            rewardChoiceIds: [],
            selectedRewardId: null,
          }),
        }),
      },
    }),
    saveSchemaVersion: 12,
  };
}

function currentSchemaWildwoodLeftoverNestedRewardSave() {
  return {
    ...currentSaveEnvelope({
      finishedRunCharacters: ["knight"],
      activeRun: wildwoodRun({
        currentScreen: "battle",
        interruptedFlow: { kind: "none" },
        wildwoodDraft: nestedWildwoodDraft({
          phase: "battle",
          currentBossId: "forge-golem",
          currentCombatTraitIds: ["tempered"],
          rewardType: "card",
          rewardChoiceIds: ["slash", "block"],
        }),
      }),
    }),
    saveSchemaVersion: 12,
  };
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
  11: currentSchemaSave,
  12: currentSchemaV12Save,
};

const FIXTURE_LIVE_SLASH = {
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal 6 Physical damage"],
  art: "slash.webp",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
};

const FIXTURE_TOMBSTONED_ANTIVENOM = {
  ...FIXTURE_LIVE_SLASH,
  id: "antivenom-potion",
};

/**
 * Active run whose persisted card piles still carry removed-content cards
 * (deck, battle snapshot piles, shop/alchemist inventories, mystery choices).
 * Covers the normalize-active-run-data stripping pass end-to-end through the
 * save schemas, including non-card sibling survival.
 */
function currentSchemaTombstonedPilesSave() {
  return currentSaveEnvelope({
    finishedRunCharacters: ["knight"],
    activeRun: {
      characterId: "knight",
      runDeck: [FIXTURE_TOMBSTONED_ANTIVENOM, FIXTURE_LIVE_SLASH],
      runGold: 12,
      runPlayerHealth: 24,
      runMaxHealth: 30,
      roomsEncountered: 3,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: "difficulty-1",
      contentSystemType: "campaign",
      currentScreen: "shop",
      shopState: {
        cards: [FIXTURE_LIVE_SLASH, FIXTURE_TOMBSTONED_ANTIVENOM],
        removeUsed: false,
        refreshesLeft: 1,
        purchasedSlotKeys: ["slot-0"],
      },
      alchemistState: {
        potions: [FIXTURE_TOMBSTONED_ANTIVENOM, FIXTURE_LIVE_SLASH],
        mixUsed: true,
        refreshesLeft: 2,
      },
      mysteryVisit: {
        eventId: "cardless-shrine",
        cardChoices: [FIXTURE_TOMBSTONED_ANTIVENOM, FIXTURE_LIVE_SLASH],
        grantedTrinketIds: [],
      },
      activeCombat: {
        battleState: {
          deck: [FIXTURE_TOMBSTONED_ANTIVENOM, FIXTURE_LIVE_SLASH],
          hand: [],
          discard: [FIXTURE_TOMBSTONED_ANTIVENOM],
          exhausted: [],
          wishQueue: [[FIXTURE_LIVE_SLASH, FIXTURE_TOMBSTONED_ANTIVENOM]],
          mana: 2,
          maxMana: 3,
          gold: 12,
          turn: 2,
          turnPhase: "player",
          playerHealth: 24,
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
            attackEffects: [],
          },
          enemyAttackEffects: [],
          playerStatuses: {},
          enemyStatuses: {},
          flags: {},
          discoveredCardIds: [],
          difficultyModifiers: [],
          trinketEffects: {},
        },
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    },
  });
}

export const MIGRATION_SCENARIO_FIXTURES: Record<string, () => Record<string, unknown>> = {
  midCombatTrinket: currentSchemaMidCombatTrinketSave,
  wildwoodTrinketReward: currentSchemaWildwoodTrinketRewardSave,
  wildwoodCardReward: currentSchemaWildwoodCardRewardSave,
  wildwoodGearReward: currentSchemaWildwoodGearRewardSave,
  wildwoodSelectedReward: currentSchemaWildwoodSelectedRewardSave,
  wildwoodCompanionHandoff: currentSchemaWildwoodCompanionHandoffSave,
  parkedWildwoodNestedReward: currentSchemaParkedWildwoodNestedRewardSave,
  parkedWildwoodDraft: currentSchemaParkedWildwoodDraftSave,
  wildwoodLeftoverNestedReward: currentSchemaWildwoodLeftoverNestedRewardSave,
  shippedBaseline: currentSchemaSave,
  tombstonedPiles: currentSchemaTombstonedPilesSave,
};
