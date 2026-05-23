import { expect, test } from "@playwright/test";
import { forceNextDestinationChoice, injectSaveState, makeCard, resumeGameMode } from "./helpers";

test.describe("Talents in Battle", () => {
  test("block-start talent gives starting block in combat", async ({ page }) => {
    await page.addInitScript(() => {
      const KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(KEY) || "{}");
      save.unlockedTalents = { ...(save.unlockedTalents || {}), block: ["block-start"] };
      save.discoveredCardIds = save.discoveredCardIds || ["slash"];
      localStorage.setItem(KEY, JSON.stringify(save));
    });

    const SLASH = makeCard();
    await injectSaveState(page, {
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await forceNextDestinationChoice(page, "Normal Combat");
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Normal Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("button", { name: "Block 10" })).toBeVisible({ timeout: 3000 });
  });

  test("physical-dmg-1 talent increases physical damage dealt", async ({ page }) => {
    await page.addInitScript(() => {
      const KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(KEY) || "{}");
      save.unlockedTalents = { ...(save.unlockedTalents || {}), physical: ["physical-dmg-1"] };
      save.discoveredCardIds = save.discoveredCardIds || ["slash"];
      localStorage.setItem(KEY, JSON.stringify(save));
    });

    const SLASH = makeCard();
    await injectSaveState(page, {
      runDeck: [SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH, SLASH],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await forceNextDestinationChoice(page, "Normal Combat");
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Normal Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const slash = page.locator('[aria-label="Play Slash"]').first();
    await expect(slash).toBeVisible({ timeout: 2000 });

    await slash.click();
    const enemyHealthText = await page.locator("text=/\\d+\\//").last().textContent();
    const enemyHpAfter = Number(enemyHealthText?.split("/")[0] ?? 30);
    expect(enemyHpAfter).toBeLessThan(30);
  });

});
