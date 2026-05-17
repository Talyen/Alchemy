import { expect, test } from "@playwright/test";
import { injectSaveState, resumeGameMode } from "./helpers";

test.describe("Run Victory", () => {
  test("defeating Act III boss shows run victory screen", async ({ page }) => {
    const highDamageCard = {
      id: "boss-killer",
      title: "Boss Killer",
      descriptionLines: ["Deal massive damage"],
      art: "placeholder",
      cost: 0,

      effects: [{ kind: "damage" as const, damageType: "burn" as const, amount: 500 }],
    };

    await injectSaveState(page, {
      characterId: "knight",
      runDeck: Array.from({ length: 6 }, () => ({ ...highDamageCard })),
      roomsEncountered: 23,
      destinationIndexInAct: 7,
      currentAct: 3,
      completedDestinations: [
        "Normal Combat", "Normal Combat", "Normal Combat",
        "Normal Combat", "Normal Combat", "Normal Combat", "Normal Combat",
      ],
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");

    await expect(page.getByRole("button", { name: "Boss Combat" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Boss Combat" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('[aria-label^="Play "]').first().click({ force: true });
    await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 15000 });

    await page.locator('[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: /Take Trinket/ }).click();

    await expect(page.getByRole("heading", { name: /Victory|Triumph|Run Complete/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Main Menu/ })).toBeVisible({ timeout: 5000 });
  });
});
