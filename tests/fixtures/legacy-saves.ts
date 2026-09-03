import { hexLabyrinthMapFixture } from "./labyrinth-hex-map";
import { saveEnvelopeFixture } from "./saves";

import { createEmptyGearInventories, createEmptyGearLoadouts } from "@/lib/gear/types";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear/crafting-ids";

function emptyGearInventories() {
  return createEmptyGearInventories() as unknown as Record<string, unknown[]>;
}

function emptyGearLoadouts() {
  return createEmptyGearLoadouts() as unknown as Record<string, Record<string, string | null>>;
}

function emptyCraftingCurrencies() {
  return { ...EMPTY_CRAFTING_CURRENCIES };
}

function currentSaveEnvelope(overrides: Record<string, unknown> = {}) {
  const activeRun = overrides.activeRun as { runGold?: number } | undefined;
  const derivedGold =
    typeof overrides.gold === "number"
      ? overrides.gold
      : typeof activeRun?.runGold === "number"
        ? activeRun.runGold
        : undefined;
  const nextOverrides =
    derivedGold !== undefined && overrides.gold === undefined ? { gold: derivedGold, ...overrides } : overrides;
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
    ...nextOverrides,
  });
}

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
    gold: 42,
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

export function currentSchemaLabyrinthRunSave() {
  const labyrinthMap = hexLabyrinthMapFixture();
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
  return asV12(
    currentSaveEnvelope({
      finishedRunCharacters: ["knight", "ranger"],
      activeRun: wildwoodRun({
        wildwoodDraft: nestedWildwoodDraft({
          currentRewardTraitIds: ["collector"],
          rewardType: "trinket",
          rewardChoiceIds: ["bone-charm", "brass-censer"],
        }),
      }),
    }),
  );
}

function withVersion(save: Record<string, unknown>, version: number) {
  return { ...save, saveSchemaVersion: version };
}

function asV12(save: Record<string, unknown>) {
  return withVersion(save, 12);
}

function currentSchemaV12Save() {
  return withVersion(currentSchemaSave(), 12);
}

function currentSchemaV13Save() {
  return withVersion(currentSchemaSave(), 13);
}

function currentSchemaLegacyGearSlotsSave() {
  const inventories = emptyGearInventories();
  inventories.knight = [
    {
      instanceId: "gear-2",
      definitionId: "ruby-ring-basic",
      affixes: [],
    },
    {
      instanceId: "gear-3",
      definitionId: "leather-armor-basic",
      affixes: [],
    },
  ];
  const loadouts = emptyGearLoadouts() as unknown as Record<string, Record<string, string | null>>;
  loadouts.knight = {
    "main-hand": null,
    "off-hand": null,
    body: null,
    "left-ring": "gear-2",
    amulet: "gear-3",
  };
  return currentSaveEnvelope({
    finishedRunCharacters: ["knight"],
    gearInventories: inventories,
    gearLoadouts: loadouts,
  });
}

function wildwoodV12Envelope(activeRun: Record<string, unknown>) {
  return asV12(currentSaveEnvelope({ finishedRunCharacters: ["knight"], activeRun }));
}

function currentSchemaWildwoodCardRewardSave() {
  return wildwoodV12Envelope(
    wildwoodRun({
      wildwoodDraft: nestedWildwoodDraft({ rewardType: "card", rewardChoiceIds: ["slash", "block"] }),
    }),
  );
}

function currentSchemaWildwoodGearRewardSave() {
  return wildwoodV12Envelope(
    wildwoodRun({
      wildwoodDraft: nestedWildwoodDraft({
        rewardType: "gear",
        rewardChoiceIds: [],
        rewardGearChoices: [{ instanceId: "gear-1", definitionId: "ruby-ring-basic", affixes: [] }],
      }),
    }),
  );
}

function currentSchemaWildwoodSelectedRewardSave() {
  return wildwoodV12Envelope(
    wildwoodRun({
      wildwoodDraft: nestedWildwoodDraft({
        rewardType: "card",
        rewardChoiceIds: ["slash", "block"],
        selectedRewardId: "slash",
      }),
    }),
  );
}

function currentSchemaWildwoodCompanionHandoffSave() {
  return wildwoodV12Envelope(
    wildwoodRun({
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
      wildwoodDraft: nestedWildwoodDraft({ rewardType: "card", rewardChoiceIds: ["slash"] }),
    }),
  );
}

function currentSchemaParkedWildwoodNestedRewardSave() {
  return asV12(
    currentSaveEnvelope({
      finishedRunCharacters: ["knight"],
      parkedRuns: {
        wildwood: wildwoodRun({
          wildwoodDraft: nestedWildwoodDraft({ rewardType: "card", rewardChoiceIds: ["slash", "bash"] }),
        }),
      },
    }),
  );
}

function currentSchemaParkedWildwoodDraftSave() {
  return asV12(
    currentSaveEnvelope({
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
  );
}

function currentSchemaWildwoodLeftoverNestedRewardSave() {
  return wildwoodV12Envelope(
    wildwoodRun({
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
  );
}

export function currentSchemaMidCombatTrinketSave() {
  return currentSaveEnvelope({
    discoveredTrinketIds: ["bone-charm", "meteorite"],
    finishedRunCharacters: ["knight"],
    gold: 10,
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
  13: currentSchemaV13Save,
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

const FIXTURE_REMOVED_FROM_CATALOG = {
  ...FIXTURE_LIVE_SLASH,
  id: "removed-from-catalog-card",
};

function currentSchemaTombstonedPilesSave() {
  return currentSaveEnvelope({
    finishedRunCharacters: ["knight"],
    activeRun: {
      characterId: "knight",
      runDeck: [FIXTURE_TOMBSTONED_ANTIVENOM, FIXTURE_REMOVED_FROM_CATALOG, FIXTURE_LIVE_SLASH],
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
        cards: [FIXTURE_TOMBSTONED_ANTIVENOM, FIXTURE_LIVE_SLASH],
        removeUsed: false,
        refreshesLeft: 1,
        purchasedSlotKeys: ["slash-1"],
      },
      alchemistState: {
        potions: [FIXTURE_TOMBSTONED_ANTIVENOM, FIXTURE_LIVE_SLASH],
        mixUsed: true,
        refreshesLeft: 2,
        purchasedSlotKeys: ["slash-1"],
      },
      mysteryVisit: {
        eventId: "cardless-shrine",
        cardChoices: [FIXTURE_TOMBSTONED_ANTIVENOM, FIXTURE_LIVE_SLASH],
        grantedTrinketIds: [],
      },
      corruptionResult: {
        originalCard: FIXTURE_REMOVED_FROM_CATALOG,
        corruptedCard: FIXTURE_LIVE_SLASH,
        transformed: false,
        delta: 1,
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

function currentSchemaLabyrinthGridV13Save() {
  return withVersion(
    currentSaveEnvelope({
      finishedRunCharacters: ["rogue"],
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
        selectedDifficulty: null,
        contentSystemType: "labyrinth",
        currentScreen: "labyrinth-map",
        rng: { seed: 42, counters: { rewards: 0, destinations: 0, events: 0, shops: 0, world: 0 } },
        labyrinthMap: {
          rows: 8,
          cols: 9,
          currentNode: { row: 0, col: 4 },
          grid: [
            [
              {
                type: "entrance",
                state: "current",
                connections: [{ row: 1, col: 4 }],
                modifiers: [],
                rewardModifiers: [],
              },
            ],
          ],
        },
        labyrinthPendingNode: { row: 1, col: 4 },
      },
    }),
    13,
  );
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
  legacyGearSlots: currentSchemaLegacyGearSlotsSave,
  labyrinthGridRegen: currentSchemaLabyrinthGridV13Save,
};
