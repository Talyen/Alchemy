// Injects a persisted mid-combat save for resume E2E coverage.
import type { Page } from "@playwright/test";
import { SAVE_KEY } from "@/lib/game-constants";
import { defaultBattleState } from "@/lib/battle";
import { baseHomesteadSave } from "../fixtures/saves";

export async function injectMidCombatSave(page: Page) {
  const battleState = { ...defaultBattleState(), turn: 2, playerHealth: 18, enemyHealth: 40 };
  const save = {
    ...baseHomesteadSave,
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
          uid: 1,
        },
      ],
      runGold: 15,
      runPlayerHealth: 18,
      runMaxHealth: 30,
      roomsEncountered: 2,
      currentAct: 1,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
      runTrinkets: [],
      encounteredRunEnemyIds: ["goblin"],
      selectedDifficulty: "difficulty-1",
      contentSystemType: "campaign",
      labyrinthMap: null,
      labyrinthPendingNode: null,
      activeCombat: {
        battleState,
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
      runTalentXP: {},
      runMaterialsEarned: {},
      currentScreen: "battle",
      destinationChoices: [],
      discoveredCardIdsAtRunStart: ["slash"],
      discoveredTrinketIdsAtRunStart: [],
    },
  };

  await page.addInitScript((data) => {
    localStorage.setItem(data.saveKey, JSON.stringify(data.save));
  }, { saveKey: SAVE_KEY, save });
}
