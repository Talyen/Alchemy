import { test, expect } from "../../fixtures/e2e";
import {
  injectBossState,
  injectActiveBattle,
  winBattleAndClaimReward,
  makeGoblinBattleState,
  startAtDestination,
  SAVE_KEY,
  readSavedGame,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { DestinationPage } from "../../pages/destination-page";
import { critical } from "../../playwright-tags";
import { expectRunPhase } from "../../pages/game-stage";

test.describe("Run Outcomes", () => {
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
        await destination.enterCombat("Boss");

        await winBattleAndClaimReward(page);

        await destination.expectVisible();
        await expect.poll(async () => (await readSavedGame(page)).activeRun?.currentAct).toBe(2);
      },
    );

    // The final boss also settles and clears the run rather than advancing an act.
    test("defeating Act III boss shows run victory screen", async ({ page, fastBattle }) => {
      void fastBattle;
      await injectBossState(page, 3);
      await page.goto("/");

      const destination = new DestinationPage(page);
      await destination.expectVisible();
      await destination.enterCombat("Boss");
      await winBattleAndClaimReward(page);

      await expectRunPhase(page, "runEnd");
      await expect(page.getByRole("heading", { name: /Victory|Triumph|Run Complete/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible({ timeout: 5000 });
      await expect.poll(async () => (await readSavedGame(page)).activeRun).toBeNull();
    });
  });

  test.describe("Defeat and Run End Flow", () => {
    test("ending a run from destination always shows the End Run screen", async ({ page }) => {
      await startAtDestination(page, {}, { forceDestination: "Normal Combat" });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "End Run" })).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: "End Run" }).click();
      await expect(page.getByRole("heading", { name: "Journey’s End" })).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "Main Menu" }).click();
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 5000 });
    });

    test(
      "after defeat, the recap shows rewards and build before returning to menu",
      critical,
      async ({ page, fastBattle }) => {
        void fastBattle;

        const battleState = makeGoblinBattleState({
          hand: [],
          mana: 0,
          turn: 1,
          playerHealth: 1,

          deathsDoorUsed: true,
          deathsDoorActive: false,
          playerStatuses: { poison: 50 },

          gearEffects: { dodgeChance: 0 },
          talentEffects: { dodgeChanceBelowHalfHealth: 0 },
        });

        battleState.currentEnemy = { ...battleState.currentEnemy, abilityIds: ["slash", "sunder", "burning-blade"] };

        await injectActiveBattle(page, battleState, {
          runPlayerHealth: 1,
          runMaxHealth: 30,
          runGoldEarned: 42,
          runHistoryPartial: false,
          runHistory: [{ id: "first", destination: "Normal Combat", act: 1, floor: null, completed: false }],
          runBoons: ["bone-charm"],
        });

        const battle = new BattlePage(page);
        await expect(battle.endTurnBtn).toBeEnabled({ timeout: 15000 });

        await battle.endTurn();
        await expect(page.getByRole("heading", { name: "Journey’s End" })).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole("region", { name: "Run journey" })).toHaveCount(0);
        await expect(page.getByText("+42", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: /View Deck/ }).click();
        await expect(page.getByRole("heading", { name: "Deck", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Close card inspection" }).click();
        await page.getByRole("button", { name: "Inspect Boons" }).click();
        await expect(page.getByRole("heading", { name: "Boons", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Close boons", exact: true }).click();
        await page.getByRole("button", { name: "Main Menu" }).click();
        await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 15000 });

        const activeRun = await page.evaluate((saveKey) => {
          const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
          return save.activeRun ?? null;
        }, SAVE_KEY);
        expect(activeRun).toBeNull();
      },
    );
  });
});
