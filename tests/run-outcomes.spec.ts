import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import {
  enableFastMode,
  injectBossState,
  resumeGameMode,
  seedRandom,
  assertDefeatFromEndRun,
  makeCard,
  startAtDestination,
  startBattleWithDeck,
  SAVE_KEY,
  injectSaveState,
} from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { RewardPage } from "./pages/reward-page";
import { critical } from "./playwright-tags";

test.describe("Run Outcomes", () => {
  test.describe("Victory Flow", () => {
    test(
      "beating Act I boss completes victory flow and displays Act II destination choices",
      critical,
      async ({ page }) => {
        await enableFastMode(page);
        await injectBossState(page);
        await seedRandom(page, 42);
        await page.goto("/");
        await resumeGameMode(page, "campaign");

        await expect(
          page.getByRole("heading", { name: /The (Forge Golem|Frostwarden|Blight Treant|Iron Bear)/ }),
        ).toBeVisible({ timeout: 5000 });
        const bossBtn = page.getByRole("button", { name: "Boss Combat" });
        await expect(bossBtn).toBeVisible({ timeout: 3000 });

        await bossBtn.click();
        await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

        await new BattlePage(page).winViaCombat();

        await new RewardPage(page).claimFirstReward();

        const destination = new DestinationPage(page);
        await destination.expectVisible();
        const destinationBtns = page
          .locator("button")
          .filter({ hasText: /Combat|Campfire|Merchant|Alchemist|Mystery|Corruption/ });
        await expect(destinationBtns.first()).toBeVisible({ timeout: 3000 });
        expect(await destinationBtns.count()).toBeGreaterThanOrEqual(1);
      },
    );

    test("defeating Act III boss shows run victory screen", async ({ page }) => {
      await enableFastMode(page);
      await injectBossState(page, 3);
      await seedRandom(page, 42);
      await page.goto("/");
      await resumeGameMode(page, "campaign");

      await expect(page.getByRole("button", { name: "Boss Combat" })).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "Boss Combat" }).click();
      await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
      await new BattlePage(page).winViaCombat();

      const reward = new RewardPage(page);
      await reward.selectFirstReward();
      await reward.addRewardBtn.click();

      await expect(page.getByRole("heading", { name: /Victory|Triumph|Run Complete/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Defeat and Run End Flow", () => {
    test("ending a run shows defeat screen and return to menu works", async ({ page, fastBattle }) => {
      test.setTimeout(60_000);
      void fastBattle;

      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeCard()),
      );
      await assertDefeatFromEndRun(page, { returnToMenu: true });
    });

    test("ending a run from destination screen shows defeat screen", critical, async ({ page }) => {
      await startAtDestination(page, {});
      await page.getByRole("button", { name: "Open destination menu" }).click();
      await page.getByRole("button", { name: "End Run" }).click();
      await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
    });

    test("after defeat in battle, Continue lands on main menu and active run is cleared", async ({
      page,
      fastBattle,
    }) => {
      test.setTimeout(60_000);
      void fastBattle;

      await startBattleWithDeck(
        page,
        Array.from({ length: 6 }, () => makeCard()),
      );
      await assertDefeatFromEndRun(page, { returnToMenu: true });

      const activeRun = await page.evaluate((saveKey) => {
        const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
        return save.activeRun ?? null;
      }, SAVE_KEY);
      expect(activeRun).toBeNull();
    });

    test("after defeat by lethal damage, Continue returns to menu", critical, async ({ page, fastBattle }) => {
      void fastBattle;

      const battleState = {
        deck: [],
        hand: [],
        discard: [],
        exhausted: [],
        mana: 0,
        maxMana: 3,
        gold: 15,
        turn: 1,
        turnPhase: "player",
        playerHealth: 1,
        playerMaxHealth: 30,
        // Knight Death's Door would otherwise absorb the lethal hit.
        deathsDoorUsed: true,
        deathsDoorActive: false,
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
        trinketEffects: {},
      };

      await injectSaveState(page, {
        currentScreen: "battle",
        runPlayerHealth: 1,
        runMaxHealth: 30,
        activeCombat: {
          battleState,
          activeLabyrinthModifiers: [],
          activeLabyrinthRewardModifiers: [],
        },
      });
      await page.goto("/");

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
