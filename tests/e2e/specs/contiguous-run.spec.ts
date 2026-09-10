import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { BattlePage } from "../../pages/battle-page";
import { DestinationPage } from "../../pages/destination-page";
import { MenuPage } from "../../pages/menu-page";
import { RewardPage } from "../../pages/reward-page";
import { critical } from "../../playwright-tags";
import { SAVE_KEY } from "../../helpers";

test.describe("Contiguous Run Journey", critical, () => {
  test("completes contiguous flow from menu through battle, reward, and next destination", async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;
    test.setTimeout(45_000);

    const menu = new MenuPage(page);
    await menu.goto();
    await menu.expectMainMenu();

    await menu.goToCharacterSelect();
    await menu.selectCharacterAndContinue("Knight");

    const noviceBtn = page.getByRole("button", { name: "Novice" });
    if (await noviceBtn.isVisible()) {
      await noviceBtn.click();
    }
    const playBtn = page.getByRole("button", { name: "Play" }).first();
    await expect(playBtn).toBeEnabled({ timeout: 5000 });
    await playBtn.click();

    const battle = new BattlePage(page);
    await expect(battle.endTurnBtn).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => battle.handCount(), { timeout: 10_000 }).toBeGreaterThan(0);

    const initialHandCount = await battle.handCount();
    expect(initialHandCount).toBeGreaterThan(0);

    await battle.winViaCombat(10);

    const reward = new RewardPage(page);
    await reward.claimFirstReward();

    const destination = new DestinationPage(page);
    await destination.expectVisible();

    const choices = page.getByRole("button", {
      name: /Combat|Campfire|Card Shop|Alchemist|Mystery|Corruption|Trinket Shop|Gear Shop/,
    });
    await expect(choices.first()).toBeVisible({ timeout: 5000 });

    const savedState = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, SAVE_KEY);

    expect(savedState?.activeRun).toBeTruthy();
    expect(savedState?.activeRun?.characterId).toBe("knight");
    expect(savedState?.activeRun?.roomsEncountered).toBeGreaterThanOrEqual(1);

    await choices.first().click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toHaveCount(0);
  });
});
