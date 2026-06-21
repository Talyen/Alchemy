import { expect } from "@playwright/test";
import { assertDefeatFromEndRun, makeCard, SAVE_KEY, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

test.describe("Run End Meta Persistence", critical, () => {
  test("after defeat in battle, Continue lands on main menu and active run is cleared", async ({
    page,
    fastBattle,
  }) => {
    test.setTimeout(60_000);
    void fastBattle;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    await assertDefeatFromEndRun(page, { returnToMenu: true });

    const activeRun = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun ?? null;
    }, SAVE_KEY);
    expect(activeRun).toBeNull();
  });

  test("after defeat by lethal damage, Continue returns to menu", async ({ page, fastBattle }) => {
    void fastBattle;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
      { runPlayerHealth: 1, runMaxHealth: 30 },
    );
    const battle = new BattlePage(page);

    await battle.endTurn();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 10000 });

    const activeRun = await page.evaluate((saveKey) => {
      const save = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return save.activeRun ?? null;
    }, SAVE_KEY);
    expect(activeRun).toBeNull();
  });
});
