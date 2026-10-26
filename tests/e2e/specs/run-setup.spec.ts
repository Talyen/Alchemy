import { expect, test } from "../../fixtures/e2e";
import { readSavedGame } from "../save-injection";
import { BattlePage } from "../../pages/battle-page";
import { MenuPage } from "../../pages/menu-page";
import { critical } from "../../playwright-tags";

test(
  "an unlocked difficulty starts a battle and Back returns to hero selection",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked("campaign", { completedDifficulties: { knight: ["difficulty-1"] } });
    await menu.selectCharacterAndContinue("Knight");
    const play = page.getByRole("button", { name: "Play", exact: true });
    await expect(play).toBeDisabled();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
    await menu.selectCharacterAndContinue("Knight");
    await page.getByRole("button", { name: "Adventurer" }).click();
    await expect(play).toBeEnabled();
    await play.click();
    await new BattlePage(page).waitForOpeningHand();
    await expect.poll(async () => (await readSavedGame(page)).activeRun?.selectedDifficulty).toBe("difficulty-2");
  },
);
