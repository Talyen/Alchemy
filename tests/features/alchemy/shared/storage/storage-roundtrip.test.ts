import { describe, expect, it } from "vitest";
import { SaveDataSchema } from "@/lib/validation";
import { createSeededRng } from "@/lib/utils";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { SaveData } from "@/features/alchemy/shared/storage/types";

function parseSave(value: unknown): SaveData {
  const result = SaveDataSchema.parse(value) as SaveData;
  if (result.activeRun) result.activeRun.runDeck = result.activeRun.runDeck.map(hydrateCard);
  return result;
}

describe("save JSON round trips", () => {
  it("minimal save round-trips through JSON serialize/deserialize", () => {
    const original = parseSave({ musicVolume: 75, sfxVolume: 25 });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
  });

  it("active run save round-trips through JSON serialize/deserialize", () => {
    const original = parseSave({
      musicVolume: 60,
      displayMode: "fullscreen",
      activeRun: {
        characterId: "wizard",
        runDeck: [
          {
            id: "fireball",
            title: "Fireball",
            descriptionLines: ["Deal 8 Burn damage"],
            art: "",
            cost: 2,
            effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
          },
        ],
        runGold: 27,
        runPlayerHealth: 18,
        runMaxHealth: 30,
        roomsEncountered: 5,
        currentAct: 2,
        destinationIndexInAct: 1,
        completedDestinations: ["Normal Combat", "Alchemist", "Campfire"],
        runBoons: ["bone-charm", "brass-censer"],
        encounteredRunEnemyIds: ["skeleton", "goblin", "slime"],
        selectedDifficulty: null,
        contentSystemType: "campaign",
        labyrinthMap: null,
        labyrinthPendingNode: null,
        activeCombat: null,
        currentScreen: null,
        interruptedFlow: { kind: "none" },
        runTalentXP: { burn: 12, poison: 8 },
      } as never,
    });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
    expect(reParsed.activeRun).not.toHaveProperty("runGold");
    expect(reParsed.gold).toBe(27);
    expect(reParsed.activeRun?.runPlayerHealth).toBe(18);
    expect(reParsed.activeRun?.runTalentXP).toEqual({ burn: 12, poison: 8 });
  });

  it("destination resume fields round-trip through JSON serialize/deserialize", () => {
    const original = parseSave({
      activeRun: {
        characterId: "knight",
        runDeck: [],
        runGold: 12,
        runPlayerHealth: 20,
        runMaxHealth: 30,
        roomsEncountered: 2,
        currentAct: 1,
        destinationIndexInAct: 1,
        completedDestinations: ["Normal Combat"],
        runBoons: [],
        contentSystemType: "campaign",
        labyrinthMap: null,
        labyrinthPendingNode: null,
        activeCombat: null,
        currentScreen: "destination",
        interruptedFlow: {
          kind: "destination",
          destinations: ["Campfire", "Mystery", "Card Shop"],
          selectedBossId: null,
          lastVictoryEnemyType: null,
          lastVictoryContentSystem: null,
        },
        runTalentXP: {},
      } as never,
    });
    const reParsed = parseSave(JSON.parse(JSON.stringify(original)));
    expect(reParsed.activeRun?.currentScreen).toBe("destination");
    expect(reParsed.activeRun?.interruptedFlow).toEqual({
      kind: "destination",
      destinations: ["Campfire", "Mystery", "Card Shop"],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    });
  });

  it("labyrinth map round-trips through JSON serialize/deserialize", () => {
    const labyrinthMap = generateLabyrinthMap(createSeededRng(42));
    const original = parseSave({
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
        runBoons: [],
        contentSystemType: "labyrinth",
        labyrinthMap,
        labyrinthPendingNode: null,
        activeCombat: null,
        currentScreen: null,
        interruptedFlow: { kind: "none" },
        runTalentXP: {},
      } as never,
    });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
    expect(reParsed.activeRun?.labyrinthMap?.currentFloor).toBe(1);
    expect(reParsed.activeRun?.labyrinthMap?.nodes["labyrinth-entrance"]?.type).toBe("entrance");
  });

  it("full save with all fields round-trips through JSON serialize/deserialize", () => {
    const original = parseSave({
      selectedAspectRatio: "16:9",
      displayMode: "windowed",
      brightness: 130,
      musicVolume: 40,
      sfxVolume: 60,
      masterVolume: 80,
      muteInBackground: true,
      autoEndTurn: false,
      discoveredCardIds: ["slash", "block", "bash", "fireball"],
      encounteredEnemyIds: ["skeleton", "goblin"],
      discoveredTrinketIds: ["bone-charm"],
      talentXP: { physical: 25, block: 10 },
      unlockedTalents: { physical: ["physical-dmg-1", "physical-dmg-2"] },
      materialInventory: { wood: 12, iron: 5, herbs: 3, food: 0, crystal: 1 },
      constructedBuildings: { "blacksmiths-forge": 1, "alchemists-laboratory": 1 },
      plantedFarms: { pasture: 1, "herb-garden": 1 },
      completedResearch: { "leyline-energy": 1, "detect-magic": 2 },
      bondedCompanions: { wolf: 3, "lizard-scout": 1 },
      completedDifficulties: { knight: ["difficulty-1"], wizard: ["difficulty-1", "difficulty-2"] },
      activeRun: null,
    });
    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
    expect(reParsed.materialInventory).toEqual({ wood: 12, iron: 5, herbs: 3, food: 0, crystal: 1 });
    // bondedCompanions fills defaults for all companion ids, use toMatchObject
    expect(reParsed.bondedCompanions).toMatchObject({ wolf: 3, "lizard-scout": 1 });
  });

  it("round-trip preserves NaN-free serialization", () => {
    const original = parseSave({});
    const serialized = JSON.stringify(original);
    expect(serialized).not.toContain("NaN");
    expect(serialized).not.toContain("undefined");
    const deserialized = JSON.parse(serialized);
    const reParsed = parseSave(deserialized);
    expect(reParsed).toEqual(original);
  });
});
