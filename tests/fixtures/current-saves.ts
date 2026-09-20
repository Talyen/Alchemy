import { saveEnvelopeFixture } from "./saves";

// Intentionally non-default values exercise round-trip recovery: every
// override below is valid but differs from SaveDataSchema defaults, while
// omitted fields rely on load-tolerant .catch defaults. Gear shelves,
// trinket boxes, and currency round-trips are covered in gear-save.test.ts
// and save-data-schema.test.ts instead of here.
export function currentSchemaCampaignSave() {
  return saveEnvelopeFixture({
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
      runHistory: [
        { id: "campaign:1:1:Normal Combat", destination: "Normal Combat", act: 1, floor: null, completed: true },
      ],
      runHistoryPartial: false,
      runGoldEarned: 35,
      currentScreen: "destination",
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
      runBoons: ["bone-charm"],
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
