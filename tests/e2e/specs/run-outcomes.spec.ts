import { test, expect } from "../../fixtures/e2e";
import {
  injectBossState,
  injectSaveState,
  injectActiveBattle,
  winBattleAndClaimReward,
  makeGoblinBattleState,
  makeHighDamageCard,
  readSavedGame,
  resumeInjectedRun,
} from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { DestinationPage } from "../../pages/destination-page";
import { critical } from "../../playwright-tags";
import { savedActivityFixture } from "../../fixtures/run-activity";
import type { Page } from "@playwright/test";
import { expectRunPhase } from "../../pages/game-stage";

async function startBossBattle(page: Page, act: 1 | 3) {
  const card = makeHighDamageCard();
  await injectBossState(page, act, {
    activity: savedActivityFixture("battle", {
      battleState: makeGoblinBattleState({
        currentEnemy: { id: act === 1 ? "forge-golem" : "blight-treant" },
        hand: [card],
        turn: 1,
        enemyHealth: 1,
        enemyMaxHealth: 1,
        contentSystemType: "campaign",
      }),
      activeLabyrinthModifiers: [],
      activeLabyrinthRewardModifiers: [],
    }),
  });
  await page.goto("/");
  await resumeInjectedRun(page);
}

test.describe("Run Outcomes", () => {
  test.describe("Victory Flow", () => {
    test(
      "beating Act I boss completes victory flow and displays Act II destination choices",
      critical,
      async ({ page, fastBattle }) => {
        void fastBattle;
        await startBossBattle(page, 1);
        const destination = new DestinationPage(page);

        await winBattleAndClaimReward(page);

        await destination.expectVisible();
        await expect.poll(async () => (await readSavedGame(page)).activeRun?.currentAct).toBe(2);
      },
    );

    // The final boss also settles and clears the run rather than advancing an act.
    test("defeating Act III boss shows run victory screen", async ({ page, fastBattle }) => {
      void fastBattle;
      await startBossBattle(page, 3);
      await winBattleAndClaimReward(page);

      await expectRunPhase(page, "runEnd");
      await expect(page.getByRole("heading", { name: /Victory|Triumph|Run Complete/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible({ timeout: 5000 });
      await expect.poll(async () => (await readSavedGame(page)).activeRun).toBeNull();
    });
  });

  test.describe("Defeat and Run End Flow", () => {
    test("ending a first Knight run reveals Rogue after the recap before returning to menu", async ({ page }) => {
      await injectSaveState(page, { finishedRunCharacters: [] });
      await page.goto("/");
      await resumeInjectedRun(page);
      await new DestinationPage(page).expectVisible();
      await page.getByRole("button", { name: "Open game menu", exact: true }).click();
      await expect(page.getByRole("button", { name: "End Run" })).toBeVisible({ timeout: 3000 });
      await page.getByRole("button", { name: "End Run" }).click();
      await expect(page.getByRole("heading", { name: "Journey’s End" })).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Hero Unlocked", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Rogue", exact: true })).toBeVisible();
      const portrait = page.getByRole("img", { name: "Rogue", exact: true });
      await expect(portrait).toBeVisible();
      await expect
        .poll(() => portrait.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
        .toBe(true);
      await expect(page.getByRole("button", { name: "Main Menu", exact: true })).toBeFocused();
      await portrait.hover();
      await expect(page.getByRole("tooltip")).toContainText("Starting Deck");
      await expect(page.getByRole("tooltip")).toHaveAttribute("data-placement", "below");
      await page.mouse.move(0, 0);
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("button", { name: "Inspect Rogue", exact: true })).toBeFocused();
      await expect(page.getByRole("tooltip")).toContainText("Starting Deck");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await page.setViewportSize({ width: 900, height: 600 });
      await expect(portrait).toBeInViewport();
      await expect(page.getByRole("button", { name: "Main Menu", exact: true })).toBeInViewport();
      await page.keyboard.press("Enter");
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

        await expect.poll(async () => (await readSavedGame(page)).activeRun).toBeNull();
      },
    );
  });
});
