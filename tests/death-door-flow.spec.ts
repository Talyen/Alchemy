import { expect } from "@playwright/test";
import { injectSaveState, makeCard, makeGoblinBattleState } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

// Death's Door triggers once per battle: the first lethal hit drops the player
// to 1 HP with a grace window, and lethal damage stays floored at 1 HP while
// grace is active (multi-hit and DoT ticks included). Only once grace expires
// does a lethal hit kill outright. These tests inject a battle that is *already*
// in Death's Door grace, which makes them fully deterministic and independent
// of the random enemy.
function deathsDoorGraceState(hand: Array<Record<string, unknown>>) {
  return makeGoblinBattleState({
    hand,
    playerHealth: 1,
    deathsDoorUsed: true,
    deathsDoorActive: true,
    deathsDoorTriggeredTurn: 2,
    deathsDoorGraceTurnsRemaining: 1,
  });
}

async function startInDeathsDoorGrace(page: import("@playwright/test").Page, hand: Array<Record<string, unknown>>) {
  await injectSaveState(page, {
    currentScreen: "battle",
    runPlayerHealth: 1,
    runMaxHealth: 30,
    runDeck: hand,
    activeCombat: {
      battleState: deathsDoorGraceState(hand),
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
    },
  });
  await page.goto("/");
}

test.describe("Death's Door", () => {
  test(
    "grace floors damage at 1 HP and expiry ends the run with defeat",
    critical,
    async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;

      await startInDeathsDoorGrace(
        page,
        Array.from({ length: 6 }, () => makeCard()),
      );
      const battle = new BattlePage(page);
      await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 5000 });

      // Playing a card while grace is active keeps the icon and floors health at 1.
      await battle.playFirstCard();
      await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 5000 });
      await expect.poll(() => battle.playerHealth()).toBe(1);

      // Remaining 1: first enemy turn still floors. Remaining 0: second enemy
      // turn still floors, then the window ends. The following enemy turn is lethal.
      await expect(battle.endTurnBtn).toBeEnabled({ timeout: 10000 });
      await battle.endTurn();
      await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 5000 });
      await expect.poll(() => battle.playerHealth()).toBe(1);

      await expect(battle.endTurnBtn).toBeEnabled({ timeout: 10000 });
      await battle.endTurn();
      await expect(battle.deathsDoorIcon).toBeHidden({ timeout: 5000 });
      await expect.poll(() => battle.playerHealth()).toBe(1);

      await expect(battle.endTurnBtn).toBeEnabled({ timeout: 10000 });
      await battle.endTurn();
      await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
    },
  );
});
