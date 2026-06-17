// Representative pre-schema save payloads used to keep old player progress loadable.
// LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION maps each source schema version to a fixture.
// Depends on deterministic labyrinth map generation so fixture tests can cover mid-run map saves.
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";

// Campaign fixture mirrors saves created before save metadata existed, with a mid-run active campaign.
export function legacyCampaignRunSave() {
  return {
    selectedResolution: "1920x1080",
    displayMode: "fullscreen",
    uiScale: "110",
    discoveredCardIds: ["slash", "block", "future-card"],
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
    constructedBuildings: ["smithy"],
    plantedFarms: ["sheep-pasture"],
    completedResearch: { carpentry: 1 },
    bondedCompanions: { wolf: 1 },
    completedDifficulties: { knight: ["difficulty-1"] },
  };
}

// Labyrinth fixture exercises persisted map hydration for a route in progress.
export function legacyLabyrinthRunSave() {
  const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
  return {
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
  };
}

// Corrupted-card fixture preserves intentional card mutations while refreshing library-owned fields.
export function legacyCorruptedCardRunSave() {
  return {
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
  };
}

/** Schema v1 save with legacy arrow talent XP (exercises v1→v2 migration). */
export function legacySchemaV1Save() {
  return {
    saveSchemaVersion: 1,
    gameBuildVersion: "0.0.9",
    contentVersion: 1,
    selectedAspectRatio: "16:9",
    displayMode: "borderless-fullscreen",
    uiScale: "100",
    discoveredCardIds: ["slash"],
    encounteredEnemyIds: [],
    discoveredTrinketIds: [],
    talentXP: { arrow: 12, physical: 4 },
    unlockedTalents: { arrow: ["arrow-damage"] },
    musicVolume: 50,
    sfxVolume: 50,
    masterVolume: 50,
    muteInBackground: true,
    autoEndTurn: true,
    brightness: 100,
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
  };
}

/** Schema v2 save missing finishedRunCharacters (exercises v2→v3 migration). */
export function legacySchemaV2Save() {
  return {
    saveSchemaVersion: 2,
    gameBuildVersion: "0.1.0",
    contentVersion: 1,
    selectedAspectRatio: "auto",
    displayMode: "borderless-fullscreen",
    uiScale: "100",
    discoveredCardIds: ["slash", "block"],
    encounteredEnemyIds: ["goblin"],
    discoveredTrinketIds: [],
    talentXP: { archery: 8 },
    unlockedTalents: { archery: ["archery-damage"] },
    musicVolume: 50,
    sfxVolume: 50,
    masterVolume: 50,
    muteInBackground: true,
    autoEndTurn: true,
    brightness: 100,
    activeRun: {
      characterId: "knight",
      runDeck: [],
      runGold: 20,
      runPlayerHealth: 25,
      runMaxHealth: 30,
      roomsEncountered: 1,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      selectedDifficulty: "difficulty-1",
      contentSystemType: "campaign",
    },
    materialInventory: { wood: 2 },
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
  };
}

/** Schema v3 save using the former Trinket field names (exercises v3->v4->v5 migration). */
function legacySchemaV3Save() {
  return {
    ...legacySchemaV2Save(),
    saveSchemaVersion: 3,
    finishedRunCharacters: ["knight"],
    discoveredTrinketIds: ["bone-charm"],
    activeRun: {
      ...(legacySchemaV2Save().activeRun as Record<string, unknown>),
      runTrinkets: ["bone-charm"],
      discoveredTrinketIdsAtRunStart: ["bone-charm"],
    },
  };
}

/** v3 mid-combat save with legacy trinketEffects on the battle snapshot. */
export function legacySchemaV3MidCombatTrinketSave() {
  return {
    ...legacySchemaV3Save(),
    activeRun: {
      ...(legacySchemaV3Save().activeRun as Record<string, unknown>),
      runTrinkets: ["meteorite", "bone-charm"],
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
  };
}

/** v3 wildwood reward phase with legacy trinket rewardType (exercises nested draft migration). */
function legacyWildwoodTrinketRewardSave() {
  return {
    ...legacySchemaV2Save(),
    saveSchemaVersion: 3,
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
        version: 2,
        phase: "reward",
        draftChoices: [],
        remainingBossIds: ["iron-bear"],
        previousBossId: "forge-golem",
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: ["collector"],
        rewardType: "trinket",
        rewardChoiceIds: ["bone-charm", "brass-censer"],
        selectedRewardId: null,
      },
    },
  };
}

/** Realistic post-launch v4 save: meta progress, gear inventory, and mid-campaign run. */
export function legacySchemaV4Save() {
  return {
    saveSchemaVersion: 4,
    gameBuildVersion: "0.1.0",
    contentVersion: 1,
    selectedAspectRatio: "auto",
    displayMode: "borderless-fullscreen",
    uiScale: "100",
    discoveredCardIds: ["slash", "block"],
    encounteredEnemyIds: ["goblin"],
    discoveredBoonIds: ["bone-charm"],
    gearInventory: [
      {
        instanceId: "gear-1",
        definitionId: "leather-armor-basic",
        modifiers: [{ kind: "flatPhysicalDamage", value: 0 }],
      },
    ],
    gearLoadouts: {},
    talentXP: { physical: 10, wish: 4 },
    unlockedTalents: { physical: ["physical-dmg-1"], wish: ["wish-boon"] },
    musicVolume: 50,
    sfxVolume: 50,
    masterVolume: 50,
    muteInBackground: true,
    autoEndTurn: true,
    brightness: 100,
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
      runBoons: ["bone-charm"],
      selectedDifficulty: "difficulty-1",
      contentSystemType: "campaign",
      currentScreen: "destination",
    },
    materialInventory: { wood: 5, iron: 3 },
    constructedBuildings: {},
    plantedFarms: {},
    completedResearch: {},
    bondedCompanions: {},
    completedDifficulties: { knight: ["difficulty-1"] },
  };
}

function shippedBaselineSave() {
  return legacySchemaV4Save();
}

export function legacySchemaV5Save() {
  const baseline = shippedBaselineSave();
  return {
    ...baseline,
    saveSchemaVersion: 5,
    gearInventory: [
      {
        instanceId: "gear-1",
        definitionId: "leather-armor-astral",
        affixes: [
          { id: "flat-physical", value: 1 },
          { id: "poison-leech", value: 5 },
        ],
      },
    ],
    activeRun: {
      ...baseline.activeRun,
      equipmentShopState: {
        gear: [
          {
            instanceId: "gear-active-1",
            definitionId: "leather-armor-astral",
            affixes: [
              { id: "flat-physical", value: 2 },
              { id: "poison-leech", value: 7 },
            ],
          },
        ],
        refreshesLeft: 1,
        firstPurchaseUsed: false,
        purchasedSlotKeys: [],
      },
      pendingReward: {
        rewardType: "gear",
        gearChoices: [
          {
            instanceId: "gear-reward-1",
            definitionId: "leather-armor-astral",
            affixes: [
              { id: "flat-physical", value: 1 },
              { id: "poison-leech", value: 5 },
            ],
          },
        ],
        selectedId: null,
        gold: 0,
        materials: {},
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    },
  };
}

export const LEGACY_SAVE_FIXTURES_BY_SOURCE_VERSION: Record<number, () => Record<string, unknown>> = {
  0: legacyCampaignRunSave,
  1: legacySchemaV1Save,
  2: legacySchemaV2Save,
  3: legacySchemaV3Save,
  4: shippedBaselineSave,
  5: legacySchemaV5Save,
};

export const MIGRATION_SCENARIO_FIXTURES: Record<string, () => Record<string, unknown>> = {
  midCombatTrinket: legacySchemaV3MidCombatTrinketSave,
  wildwoodTrinketReward: legacyWildwoodTrinketRewardSave,
  shippedBaseline: shippedBaselineSave,
};
