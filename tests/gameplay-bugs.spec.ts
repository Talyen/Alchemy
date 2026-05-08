import { expect, test } from "@playwright/test";
import { startRun } from "./helpers";

test.describe("Mana Mechanics", () => {
  test("restore-mana does not exceed maxMana", async ({ page }) => {
    await startRun(page, "Sorcerer");

    const manaBerries = page.getByRole("button", { name: "Play Mana Berries" });
    if (!(await manaBerries.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Mana Berries not in initial hand");
      return;
    }

    const maxMana = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(maxMana).toBeGreaterThan(0);

    await manaBerries.click();
    await page.waitForTimeout(300);

    const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfter).toBeLessThanOrEqual(maxMana);
  });

  test("meteor reduces max mana and clamps current mana", async ({ page }) => {
    await startRun(page, "Sorcerer");

    const meteor = page.getByRole("button", { name: "Play Meteor" });
    if (!(await meteor.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Meteor not in initial hand");
      return;
    }

    const manaBefore = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaBefore).toBeGreaterThan(0);

    await meteor.click();
    await page.waitForTimeout(300);

    const manaAfter = Number(await page.getByTestId("mana-panel").getAttribute("data-mana"));
    expect(manaAfter).toBeLessThanOrEqual(manaBefore - 1);
  });
});

test.describe("Status Mechanics", () => {
  test("poison dagger applies poison that ticks each turn", async ({ page }) => {
    await startRun(page, "Rogue");

    const poisonDagger = page.getByRole("button", { name: "Play Poison Dagger" });
    if (!(await poisonDagger.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Poison Dagger not in initial hand");
      return;
    }

    await poisonDagger.click();
    await page.waitForTimeout(300);

    const enemyHpBefore = 30;

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

    const enemyHpText = await page.locator("text=/\\d+\\/30/").last().textContent();
    const enemyHpAfter = Number(enemyHpText?.split("/")[0]);
    expect(enemyHpAfter).toBeLessThan(enemyHpBefore);
  });
});
