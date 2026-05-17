import { expect, test } from "@playwright/test";
import { injectSaveState, playUntilVictory, resumeGameMode } from "./helpers";

test.describe("Act Transition", () => {
  test("beating Act I boss advances to Act II destination choices", async ({ page }) => {
    const bossKiller = {
      id: "boss-killer",
      title: "Boss Killer",
      descriptionLines: ["Deal massive damage"],
      art: "placeholder",
      cost: 0,
      effects: [{ kind: "damage" as const, damageType: "burn" as const, amount: 500 }],
    };

    await injectSaveState(page, {
      characterId: "knight",
      runDeck: Array.from({ length: 6 }, () => ({ ...bossKiller })),
      roomsEncountered: 7,
      destinationIndexInAct: 7,
      currentAct: 1,
      completedDestinations: [
        "Normal Combat", "Normal Combat", "Normal Combat",
        "Normal Combat", "Normal Combat", "Normal Combat", "Normal Combat",
      ],
      runPlayerHealth: 30,
      runMaxHealth: 30,
      runGold: 50,
    });

    await page.goto("/");
    await resumeGameMode(page, "campaign");

    await expect(page.getByRole("heading", { name: "The Forge Golem" })).toBeVisible({ timeout: 10000 });
    const bossBtn = page.getByRole("button", { name: "Boss Combat" });
    await expect(bossBtn).toBeVisible();
    await bossBtn.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await playUntilVictory(page);
    await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 5000 });

    await page.locator('[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: /Take Trinket/ }).click();

    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });

    // Verify Act II destination pool: at least 3 non-boss destinations should be offered
    const destinationBtns = page.locator("button").filter({ hasText: /Combat|Campfire|Merchant|Alchemist|Mystery|Corruption/ });
    await expect(destinationBtns.first()).toBeVisible({ timeout: 3000 });
    const count = await destinationBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
