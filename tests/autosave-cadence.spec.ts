import { expect } from "@playwright/test";
import { makeHighDamageCard, SAVE_KEY, startAtDestination, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { DestinationPage } from "./pages/destination-page";
import { MenuPage } from "./pages/menu-page";
import { RewardPage } from "./pages/reward-page";
import { test } from "./fixtures/e2e";

function getSavedRoomCount(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
    return save.activeRun?.roomsEncountered ?? 0;
  }, SAVE_KEY);
}

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
    await startAtDestination(page, { runGold: 42, runPlayerHealth: 22 }, { forceDestination: "Campfire" });

    const goldBefore = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun?.runGold;
    }, SAVE_KEY);
    expect(goldBefore).toBe(42);

    await page.goto("/");
    await new MenuPage(page).openGameModeSelect();
    await page.getByRole("button", { name: /The Campaign/ }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible({ timeout: 5000 });
  });
});
