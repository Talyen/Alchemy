import { expect } from "@playwright/test";
import { assertDefeatFromEndRun, makeCard, startAtDestination, startBattleWithDeck } from "./helpers";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

test.describe("Game Over via End Run", critical, () => {
  test("ending a run shows defeat screen and return to menu works", async ({ page, fastBattle }) => {
    test.setTimeout(60_000);
    void fastBattle;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    await assertDefeatFromEndRun(page, { returnToMenu: true });
  });

  test("ending a run from destination screen shows defeat screen", async ({ page }) => {
    await startAtDestination(page, {});
    await page.getByRole("button", { name: "Open destination menu" }).click();
    await page.getByRole("button", { name: "End Run" }).click();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
  });
});
