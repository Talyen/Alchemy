import { expect, test } from "@playwright/test";
import { injectMidCombatSave } from "./e2e/mid-combat-save";
import { SAVE_KEY } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";

test.describe("Mid-combat save resume", critical, () => {
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
});
