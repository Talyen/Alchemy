import { expect, test } from "@playwright/test";
import { injectActiveBattle, makeGoblinBattleState, SAVE_KEY } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";

test("player death finishes its particle burst before defeat", critical, async ({ page }) => {
  await injectActiveBattle(
    page,
    makeGoblinBattleState({
      hand: [],
      mana: 0,
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      gearEffects: { dodgeChance: 0 },
      talentEffects: { dodgeChanceBelowHalfHealth: 0 },
    }),
    { runPlayerHealth: 1, runMaxHealth: 30 },
  );
  const battle = new BattlePage(page);
  await expect(battle.endTurnBtn).toBeEnabled();
  await battle.endTurnBtn.click();
  const portrait = page.getByTestId("battle-player-art-panel");
  const burst = portrait.locator("canvas");
  await expect(burst).toBeVisible();
  await expect(portrait.locator('img[style*="clip-path"]')).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Defeat" })).toBeHidden();
  await expect
    .poll(async () =>
      Number(
        await portrait
          .locator('img[style*="clip-path"]')
          .first()
          .evaluate((img) => img.style.opacity),
      ),
    )
    .toBeLessThan(0.9);
  await page.screenshot({ path: "/tmp/alchemy-player-death.png" });
  await expect(burst).toBeHidden();
  await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").activeRun, SAVE_KEY)).toBeNull();
});
