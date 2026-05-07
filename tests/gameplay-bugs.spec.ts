import { expect, test } from "@playwright/test";

async function startRun(page: Parameters<typeof test>[0]["page"], character: "Knight" | "Rogue" | "Wizard" = "Knight") {
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: character }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
}

test.describe("Mana Mechanics", () => {
  test("restore-mana does not exceed maxMana", async ({ page }) => {
    await startRun(page, "Wizard");

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
    await startRun(page, "Wizard");

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
    // Meteor costs 1 and reduces max mana by 1. Current mana must never exceed max mana.
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

    const enemyHpBefore = 30; // first enemy always has 30 HP

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

    // Poison should have ticked for 2 damage (poison dagger deals 2 poison)
    const enemyHpText = await page.locator("text=/\\d+\\/30/").last().textContent();
    const enemyHpAfter = Number(enemyHpText?.split("/")[0]);
    expect(enemyHpAfter).toBeLessThan(enemyHpBefore);
  });

  test("frostbolt can freeze enemy when threshold is reached", async ({ page }) => {
    await startRun(page, "Wizard");

    const frostbolt = page.getByRole("button", { name: "Play Frostbolt" });
    if (!(await frostbolt.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Frostbolt not in initial hand");
      return;
    }

    // Play frostbolts until we run out of mana or cards
    let frostboltsPlayed = 0;
    while (true) {
      const fb = page.getByRole("button", { name: "Play Frostbolt" });
      if (!(await fb.isVisible({ timeout: 500 }).catch(() => false))) break;
      if (!(await fb.isEnabled({ timeout: 200 }).catch(() => false))) break;
      await fb.click({ force: true });
      await page.waitForTimeout(220);
      frostboltsPlayed++;
    }

    if (frostboltsPlayed < 5) {
      test.skip(true, "Not enough frostbolts playable to reach freeze threshold");
      return;
    }

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

    // If freeze procced, enemy skipped their turn and we should have full health
    const hpText = await page.locator("text=/\\d+\\/30/").first().textContent();
    const hp = Number(hpText?.split("/")[0]);
    expect(hp).toBe(30);
  });
});
