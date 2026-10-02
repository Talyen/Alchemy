import { expect, test } from "../../fixtures/e2e";
import { BattlePage } from "../../pages/battle-page";
import { MenuPage } from "../../pages/menu-page";

test("an unlocked difficulty starts a battle and Back returns to hero selection", async ({ page, fastBattle }) => {
  void fastBattle;
  const menu = new MenuPage(page);
  await menu.goToCharacterSelectUnlocked("campaign", { completedDifficulties: { knight: ["difficulty-1"] } });
  await menu.selectCharacterAndContinue("Knight");
  const play = page.getByRole("button", { name: "Play", exact: true });
  await expect(play).toBeDisabled();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible();
  await menu.selectCharacterAndContinue("Knight");
  await page.getByRole("button", { name: "Novice" }).click();
  await expect(play).toBeEnabled();
  await play.click();
  await new BattlePage(page).waitForOpeningHand();
});
