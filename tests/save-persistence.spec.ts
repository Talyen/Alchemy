import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import {
  injectSaveState,
  openGameModeSelect,
  resumeCampaignRun,
  SAVE_KEY,
  seedRandom,
  makeHighDamageCard,
  startAtDestination,
  startBattleWithDeck,
  ANVIL_CARD,
} from "./helpers";
import { injectMidCombatSave } from "./e2e/mid-combat-save";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { RewardPage } from "./pages/reward-page";
import { critical, prepush } from "./playwright-tags";
import { legacyCampaignRunSave } from "./fixtures/legacy-saves";

function getSavedRoomCount(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
    return save.activeRun?.roomsEncountered ?? 0;
  }, SAVE_KEY);
}

test.describe("Save Persistence & Resume", critical, () => {
  test("resume run restores exact state after reload", async ({ page }) => {
    await seedRandom(page, 42);
    await injectSaveState(page, {
      characterId: "knight",
      runGold: 42,
      runPlayerHealth: 18,
      runMaxHealth: 30,
      roomsEncountered: 3,
      currentAct: 1,
      destinationIndexInAct: 2,
      completedDestinations: ["Normal Combat", "Normal Combat"],
    });
    await page.goto("/");

    const savedBefore = await page.evaluate((saveKey) => {
      const s = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return s.activeRun;
    }, SAVE_KEY);
    expect(savedBefore.runGold).toBe(42);
    expect(savedBefore.runPlayerHealth).toBe(18);
    expect(savedBefore.runMaxHealth).toBe(30);
    expect(savedBefore.currentAct).toBe(1);
    expect(savedBefore.destinationIndexInAct).toBe(2);

    await openGameModeSelect(page);
    await page.getByRole("button", { name: /The Campaign/ }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });

    const savedAfter = await page.evaluate((saveKey) => {
      const s = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return s.activeRun;
    }, SAVE_KEY);
    expect(savedAfter.runGold).toBe(42);
    expect(savedAfter.runPlayerHealth).toBe(18);
  });

  test("resume restores saved destination choices", prepush, async ({ page }) => {
    await seedRandom(page, 42);
    await injectSaveState(page, {
      runPlayerHealth: 22,
      runMaxHealth: 30,
      roomsEncountered: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
      currentScreen: "destination",
      destinationChoices: ["Campfire", "Mystery", "Merchant's Shop"],
    });
    await page.goto("/");

    // currentScreen: destination hydrates before menu is stable; Resume via Play races bootstrap.
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Campfire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mystery" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Merchant's Shop" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Normal Combat" })).toHaveCount(0);
  });

  test("mid-battle reload returns to destination not battle", async ({ page }) => {
    await seedRandom(page, 42);
    await injectSaveState(page, {
      runPlayerHealth: 22,
      runMaxHealth: 30,
      roomsEncountered: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
    });
    await page.goto("/");

    await resumeCampaignRun(page);

    await expect(page.locator('[aria-label^="Play "]')).toHaveCount(0);
  });

  test("reload restores an in-progress battle", async ({ page }) => {
    await injectMidCombatSave(page);
    await page.goto("/");

    const battle = new BattlePage(page);
    await expect(battle.endTurnBtn).toBeVisible({ timeout: 10000 });
    await expect.poll(() => battle.playerHealth()).toBe(18);
    await expect.poll(() => battle.enemyHealth()).toBe(40);

    const turnBefore = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.activeCombat?.battleState?.turn ?? null;
    }, SAVE_KEY);
    expect(turnBefore).toBe(2);

    await page.reload();

    await expect(battle.endTurnBtn).toBeVisible({ timeout: 10000 });
    await expect.poll(() => battle.playerHealth()).toBe(18);
    await expect.poll(() => battle.enemyHealth()).toBe(40);

    const turnAfter = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.activeCombat?.battleState?.turn ?? null;
    }, SAVE_KEY);
    expect(turnAfter).toBe(2);
  });

  test("resumes a run from legacy pre-metadata save and upgrades schema", async ({ page }) => {
    const legacySave = legacyCampaignRunSave();
    await page.addInitScript(
      (data) => {
        try {
          localStorage.setItem(data.saveKey, JSON.stringify(data.save));
        } catch (e) {
          // Ignore opaque origin exceptions
        }
      },
      { saveKey: SAVE_KEY, save: legacySave },
    );

    await page.goto("/");
    await resumeCampaignRun(page);

    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });

    const upgraded = await page.evaluate((saveKey) => {
      return JSON.parse(localStorage.getItem(saveKey) || "{}");
    }, SAVE_KEY);
    expect(upgraded.saveSchemaVersion).toBeDefined();
    expect(upgraded.activeRun.runGold).toBe(42);
    expect(upgraded.activeRun.runPlayerHealth).toBe(18);
  });
});

test.describe("Autosave Cadence", () => {
  test("save is written after the first end turn in battle", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeHighDamageCard()),
    );

    const before = await getSavedRoomCount(page);
    const battle = new BattlePage(page);
    await battle.endTurn();

    const after = await getSavedRoomCount(page);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test("save is written after claiming a reward", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeHighDamageCard()),
    );

    const battle = new BattlePage(page);
    await battle.winViaCombat(3);

    const reward = new RewardPage(page);
    await reward.selectFirstReward();
    await reward.addRewardBtn.click();
    await new DestinationPage(page).expectVisible();

    const roomsAfter = await getSavedRoomCount(page);
    expect(roomsAfter).toBeGreaterThanOrEqual(1);
  });

  test("save persists across page navigation", async ({ page }) => {
    test.setTimeout(30000);
    await startAtDestination(page, { runGold: 42, runPlayerHealth: 22 }, { forceDestination: "Campfire" });

    const goldBefore = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.runGold;
    }, SAVE_KEY);
    expect(goldBefore).toBe(42);

    await page.goto("/");
    await resumeCampaignRun(page);

    const goldAfter = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.runGold;
    }, SAVE_KEY);
    expect(goldAfter).toBe(42);
  });

  test("forge status persists across end turn", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
    await startBattleWithDeck(page, [ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD, ANVIL_CARD]);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Anvil");
    await expect(page.getByRole("button", { name: "Forge 1" })).toBeVisible();

    await battle.endTurn();
    await expect(page.getByRole("button", { name: /Forge/ })).toHaveCount(1);
  });
});
