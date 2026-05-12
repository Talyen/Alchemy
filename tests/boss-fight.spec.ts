import { expect, test } from "@playwright/test";
import { injectSaveState, playUntilVictory } from "./helpers";

function injectBossState(page: Parameters<typeof test>[0]["page"], act = 1) {
  const highDamageCard = {
    id: "boss-killer",
    title: "Boss Killer",
    descriptionLines: ["Deal massive damage"],
    art: "placeholder",
    cost: 0,
    template: "arcane" as const,
    effects: [{ kind: "damage" as const, damageType: "burn" as const, amount: 500 }],
  };
  return injectSaveState(page, {
    characterId: "knight",
    runDeck: Array.from({ length: 6 }, () => ({ ...highDamageCard })),
    roomsEncountered: 7,
    destinationIndexInAct: 7,
    currentAct: act,
    completedDestinations: [
      "Normal Combat", "Normal Combat", "Normal Combat",
      "Normal Combat", "Normal Combat", "Normal Combat", "Normal Combat",
    ],
    runPlayerHealth: 30,
    runMaxHealth: 30,
  });
}

test.describe("Boss Fight", () => {
  test("Act I boss combat starts and transitions to Act II", async ({ page }) => {
    await injectBossState(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Resume Run" }).click();

    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    const bossBtn = page.getByRole("button", { name: "Boss Combat" });
    await expect(bossBtn).toBeVisible();

    await bossBtn.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    await playUntilVictory(page);
    await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 5000 });

    await page.locator('[aria-label^="Select "]').first().click();
    await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
  });
});
