// Injects a persisted mid-combat save for resume E2E coverage.
import type { Page } from "@playwright/test";
import { makeCard } from "./cards";
import { makeGoblinBattleState } from "../fixtures/battle-state";
import { injectSaveState } from "./save-injection";

export async function injectMidCombatSave(page: Page) {
  // Playable hand + mana and autoEndTurn disabled so resume assertions do not
  // race the auto-end timer into Defeat (empty hand + autoEndTurn:true was
  // flaky on CI). Card art stays a string filename — no asset imports here.
  const slash = makeCard({ art: "slash.webp", uid: 1 });
  await injectSaveState(page, {
    autoEndTurn: false,
    runDeck: [slash],
    runGold: 15,
    runPlayerHealth: 18,
    roomsEncountered: 2,
    destinationIndexInAct: 1,
    completedDestinations: ["Normal Combat"],
    runTrinkets: ["tattered-pages"],
    encounteredRunEnemyIds: ["goblin"],
    selectedDifficulty: "difficulty-1",
    currentScreen: "battle",
    interruptedFlow: { kind: "none" },
    activeCombat: {
      battleState: makeGoblinBattleState({
        hand: [slash],
        trinketEffects: { extraDrawPerBattle: 1 },
      }),
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
    },
  });
}
