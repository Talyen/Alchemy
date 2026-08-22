import { expect } from "@playwright/test";
import type { BattleCard } from "@/lib/game-data";
import { test } from "./fixtures/e2e";
import {
  injectBossState,
  injectActiveBattle,
  assertDefeatFromEndRun,
  winBattleAndClaimReward,
  makeCard,
  makeGoblinBattleState,
  startAtDestination,
  SAVE_KEY,
} from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { critical } from "./playwright-tags";

test.describe("Run Outcomes", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test.describe("Victory Flow", () => {
    test(
      "beating Act I boss completes victory flow and displays Act II destination choices",
      critical,
      async ({ page, fastBattle }) => {
        void fastBattle;
        await injectBossState(page, 1);
        await page.goto("/");

        const destination = new DestinationPage(page);
        await destination.expectVisible();
        await destination.enterCombat("Boss Combat");

        await winBattleAndClaimReward(page);

        const destinationBtns = page.getByRole("button", {
          name: /Combat|Campfire|Merchant|Alchemist|Mystery|Corruption|Trinket Shop|Equipment Shop/,
        });
        await expect(destinationBtns.first()).toBeVisible({ timeout: 3000 });
        expect(await destinationBtns.count()).toBeGreaterThanOrEqual(1);
      },
    );

    test("defeating Act III boss shows run victory screen", critical, async ({ page, fastBattle }) => {
      void fastBattle;
      await injectBossState(page, 3);
      await page.goto("/");

      const destination = new DestinationPage(page);
      await destination.expectVisible();
      await destination.enterCombat("Boss Combat");
      await winBattleAndClaimReward(page);

      await expect(page.getByRole("heading", { name: /Victory|Triumph|Run Complete/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Defeat and Run End Flow", () => {
    test("ending a run from destination screen shows defeat screen", critical, async ({ page }) => {
      await startAtDestination(page, {}, { forceDestination: "Normal Combat" });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "End Run" })).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: "End Run" }).click();
      await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
    });

    test("after defeat in battle, Continue lands on main menu and active run is cleared", async ({
      page,
      fastBattle,
    }) => {
      void fastBattle;

      // End Run is reachable from an injected battle screen — no full boot needed.
      await injectActiveBattle(page, makeGoblinBattleState());
      await assertDefeatFromEndRun(page, { returnToMenu: true });

      const activeRun = await page.evaluate((saveKey) => {
        const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
        return save.activeRun ?? null;
      }, SAVE_KEY);
      expect(activeRun).toBeNull();
    });

    test("after defeat by lethal damage, Continue returns to menu", critical, async ({ page, fastBattle }) => {
      void fastBattle;

      const battleState = makeGoblinBattleState({
        hand: [],
        mana: 0,
        turn: 1,
        playerHealth: 1,
        // Knight Death's Door would otherwise absorb the lethal hit.
        deathsDoorUsed: true,
        deathsDoorActive: false,
      });

      await injectActiveBattle(page, battleState, {
        runPlayerHealth: 1,
        runMaxHealth: 30,
      });

      const battle = new BattlePage(page);
      await expect(battle.endTurnBtn).toBeVisible({ timeout: 10000 });

      await battle.endTurn();
      await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 10000 });

      const activeRun = await page.evaluate((saveKey) => {
        const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
        return save.activeRun ?? null;
      }, SAVE_KEY);
      expect(activeRun).toBeNull();
    });
  });
});

// Death's Door triggers once per battle: the first lethal hit drops the player
// to 1 HP with a grace window, and lethal damage stays floored at 1 HP while
// grace is active (multi-hit and DoT ticks included). Only once grace expires
// does a lethal hit kill outright. These tests inject a battle that is *already*
// in Death's Door grace, which makes them fully deterministic and independent
// of the random enemy.
function deathsDoorGraceState(hand: BattleCard[]) {
  return makeGoblinBattleState({
    hand,
    playerHealth: 1,
    deathsDoorUsed: true,
    deathsDoorActive: true,
    deathsDoorTriggeredTurn: 2,
    deathsDoorGraceTurnsRemaining: 1,
  });
}

async function startInDeathsDoorGrace(page: import("@playwright/test").Page, hand: BattleCard[]) {
  await injectActiveBattle(page, deathsDoorGraceState(hand), {
    runPlayerHealth: 1,
    runMaxHealth: 30,
    runDeck: hand,
  });
}

test.describe("Death's Door", critical, () => {
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
