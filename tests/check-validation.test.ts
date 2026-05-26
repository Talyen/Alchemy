import { test } from "vitest";
import { SaveDataSchema } from "@/lib/validation/save-schemas";

test("validation check", () => {
  const BASE_HOMESTEAD_SAVE = {
    saveSchemaVersion: 1,
    gameBuildVersion: "1.0.0",
    contentVersion: 1,
    selectedAspectRatio: "auto",
    displayMode: "borderless-fullscreen",
    uiScale: "100",
    brightness: 100,
    musicVolume: 50,
    sfxVolume: 50,
    masterVolume: 50,
    muteInBackground: true,
    autoEndTurn: true,
    completedDifficulties: { knight: [], rogue: [], wizard: [], ranger: [], alchemist: [], warlock: [], druid: [], wildcard: [] },
    activeRun: null,
    materialInventory: { wood: 999, iron: 999, herbs: 999, food: 999, crystal: 999 },
    constructedBuildings: { "blacksmiths-forge": 0, "hunters-lodge": 0, "alchemy-lab": 0, "runesmiths-workshop": 0, "companion-sanctuary": 0, "wishing-well": 0 },
    plantedFarms: { "wheat-field": 0, "herb-garden": 0, "chicken-coop": 0, "pasture": 0, "orchard": 0, "crystal-garden": 0 },
    completedResearch: { "carpentry": 0, "masonry": 0, "crop-rotation": 0, "animal-husbandry": 0, "fortified-walls": 0, "metallurgy": 0 },
    bondedCompanions: { "wolf": 0, "lizard-scout": 0, "imp": 0, "frost-whelp": 0, "bear": 0, "panther": 0, "phoenix": 0 },
    discoveredCardIds: ["slash"],
    encounteredEnemyIds: [],
    discoveredTrinketIds: [],
    talentXP: {},
    unlockedTalents: {},
  };

  const result = SaveDataSchema.safeParse(BASE_HOMESTEAD_SAVE);
  if (result.success) {
    console.log("SUCCESS!");
  } else {
    console.log("FAILED:", JSON.stringify(result.error.format(), null, 2));
  }
});
