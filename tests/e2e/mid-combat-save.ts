// Injects a persisted mid-combat save for resume E2E coverage.
import type { Page } from "@playwright/test";
import { SAVE_KEY } from "@/lib/game-constants";
import { baseHomesteadSave } from "../fixtures/saves";

export async function injectMidCombatSave(page: Page) {
  // Keep this fixture free of runtime battle imports so Playwright never loads game art during test discovery.
  const battleState = {
    deck: [],
    hand: [],
    discard: [],
    exhausted: [],
    mana: 0,
    maxMana: 3,
    gold: 15,
    turn: 2,
    turnPhase: "player",
    playerHealth: 18,
    playerMaxHealth: 30,
    enemyHealth: 40,
    enemyMaxHealth: 40,
    currentEnemy: {
      id: "goblin",
      title: "Goblin",
      subtitle: "",
      descriptionLines: [],
      art: "goblin.webp",
      enemyType: "normal",
      traits: [],
      attackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    },
    enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    playerStatuses: {},
    enemyStatuses: {},
    flags: {},
    discoveredCardIds: ["slash"],
    difficultyModifiers: [],
    boonEffects: { extraDrawPerBattle: 1 },
  };
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
      runBoons: ["tattered-pages"],
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
      discoveredBoonIdsAtRunStart: [],
    },
  };

  await page.addInitScript(
    (data) => {
      localStorage.setItem(data.saveKey, JSON.stringify(data.save));
    },
    { saveKey: SAVE_KEY, save },
  );
}
