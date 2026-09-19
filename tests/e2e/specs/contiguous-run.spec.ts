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
      // Exact match: a loose "Play" also matches the battle autoplay toggle.
      const playBtn = page.getByRole("button", { name: "Play", exact: true }).first();
      await expect(playBtn).toBeEnabled({ timeout: 5000 });
      await playBtn.click();
    }
    // Fresh characters skip difficulty select and start the battle directly,
    // so there is no Play button to press in that case.

    const battle = new BattlePage(page);
    await expect(battle.endTurnBtn).toBeVisible({ timeout: 10_000 });
    await battle.waitForOpeningHand();

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
    await battle.waitForOpeningHand(15_000);
    await expect(battle.endTurnBtn).toBeEnabled();
  });
});
