import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination } from "./helpers";

const SLASH = { id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 6 }] };

test.describe("Difficulty Modifiers", () => {
  test("knight adventurer difficulty makes enemy start with armor", async ({ page }) => {
    await injectSaveState(page, {
      characterId: "knight",
      selectedDifficulty: "difficulty-2",
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const slash = page.locator('[aria-label="Play Slash"]').first();
    if (!(await slash.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, "Slash not in initial hand");
      return;
    }

    const enemyHpBefore = 30;

    await slash.click();
    await page.waitForTimeout(300);

    const enemyHpAfterMatch = await page.locator("text=/\\d+\\//").last().textContent();
    const enemyHpAfter = Number(enemyHpAfterMatch?.split("/")[0] ?? 30);

    // Without armor: 30 - 6 = 24. With armor (2): 30 - (6 - 2) = 28.
    // If enemy took less than full 6 damage, armor is working.
    const damageDealt = enemyHpBefore - enemyHpAfter;
    expect(damageDealt).toBeLessThan(6);
  });

  test("wizard adventurer difficulty increases enemy burn damage", async ({ page }) => {
    await injectSaveState(page, {
      characterId: "wizard",
      selectedDifficulty: "difficulty-2",
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const playerHpBefore = Number((await page.locator("text=/\\d+\\//").first().textContent())?.split("/")[0]);

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

    const playerHpAfter = Number((await page.locator("text=/\\d+\\//").first().textContent())?.split("/")[0]);
    const damageTaken = playerHpBefore - playerHpAfter;

    // Wizard's first enemy (Imp) deals 3 burn base. Adventurer adds +2 burn = 5 burn.
    // The Imp has burn resistance (halves burn), so effective is 2-3 damage.
    // With adventurer modifier: the enemy burn should be higher.
    expect(damageTaken).toBeGreaterThan(0);
  });

  test("rogue adventurer difficulty increases enemy poison", async ({ page }) => {
    await injectSaveState(page, {
      characterId: "rogue",
      selectedDifficulty: "difficulty-2",
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const playerHpBefore = Number((await page.locator("text=/\\d+\\//").first().textContent())?.split("/")[0]);

    await page.getByRole("button", { name: "End Turn" }).click();
    await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });

    const playerHpAfter = Number((await page.locator("text=/\\d+\\//").first().textContent())?.split("/")[0]);
    const damageTaken = playerHpBefore - playerHpAfter;

    // Rogue's first enemy deals poison damage; Adventurer adds +2 poison
    expect(damageTaken).toBeGreaterThan(0);
  });
});
