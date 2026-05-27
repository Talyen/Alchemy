// Representative pre-schema save payloads used to keep old player progress loadable.
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
      runDeck: [{ id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "old-slash.webp", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] }],
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
      runDeck: [{
        id: "fireball",
        title: "Old Fireball Title",
        descriptionLines: ["Deal 9 Burn damage"],
        art: "old-fireball.webp",
        cost: 2,
        effects: [{ kind: "damage", damageType: "burn", amount: 9 }],
        corrupted: true,
        baseTitle: "Fireball",
        corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }],
      }],
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
