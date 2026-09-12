import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { BattlePage } from "../../pages/battle-page";
import { DestinationPage } from "../../pages/destination-page";
import { MenuPage } from "../../pages/menu-page";
import { RewardPage } from "../../pages/reward-page";
import { critical } from "../../playwright-tags";
import { SAVE_KEY, seedRandom } from "../../browser-helpers";

test.describe("Contiguous Run Journey", critical, () => {
  test("completes contiguous flow from menu through battle, reward, and next destination", async ({
    page,
    fastBattle,
  }) => {
    void fastBattle;
    test.setTimeout(60_000);

    await seedRandom(page, 42);
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
    await expect.poll(() => battle.handCount(), { timeout: 30_000 }).toBeGreaterThan(0);

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

    await expect
      .poll(() =>
        page.evaluate((key) => {
          const run = JSON.parse(localStorage.getItem(key) || "{}").activeRun;
          return run?.characterId === "knight" && run.roomsEncountered >= 1;
        }, SAVE_KEY),
      )
      .toBe(true);

    await destination.enterAnyCombat();
    await expect(battle.endTurnBtn).toBeEnabled();
    await expect(battle.hand.first()).toBeVisible();
  });
});
